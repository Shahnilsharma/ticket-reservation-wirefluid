import { createPublicClient, http } from 'viem';
import prisma from './db.js';
const CONTRACT_ADDRESS = (process.env.WIREFLUID_CONTRACT_ADDRESS ?? '0x5D21dA3Fd25Af95f6b26E8b8784C431E06D5A940');
const RPC_URL = process.env.WIREFLUID_RPC_URL ?? process.env.RPC_URL ?? 'https://evm.wirefluid.com';
const SYNC_INTERVAL_MS = Number(process.env.CONTRACT_SYNC_INTERVAL_MS ?? 30_000);
const BATCH_SIZE = Number(process.env.CONTRACT_SYNC_BATCH_SIZE ?? 150);
const START_BLOCK = BigInt(process.env.CONTRACT_START_BLOCK ?? '0');
const publicClient = createPublicClient({
    transport: http(RPC_URL),
});
const seatAbi = [
    {
        type: 'function',
        name: 'getSeatByIndex',
        stateMutability: 'view',
        inputs: [
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'uint256' },
        ],
        outputs: [
            {
                type: 'tuple',
                components: [
                    { name: 'eventId', type: 'uint256' },
                    { name: 'section', type: 'uint256' },
                    { name: 'row', type: 'uint256' },
                    { name: 'seatNumber', type: 'uint256' },
                    { name: 'price', type: 'uint256' },
                    { name: 'tokenId', type: 'uint256' },
                    { name: 'isReserved', type: 'bool' },
                ],
            },
        ],
    },
];
const sectionTierByName = new Map([
    ['north stand', 1],
    ['north-east stand', 1],
    ['south-east stand', 2],
    ['south stand', 2],
    ['south-west stand', 3],
    ['north-west stand', 3],
]);
let lastSyncAt = 0;
let syncInFlight = null;
let syncTimer = null;
function rowLabelToContractRow(rowLabel) {
    const normalized = rowLabel.trim().toUpperCase();
    let value = 0;
    for (let index = 0; index < normalized.length; index += 1) {
        const code = normalized.charCodeAt(index);
        if (code < 65 || code > 90) {
            return 0;
        }
        value = value * 26 + (code - 64);
    }
    return Math.max(value - 1, 0);
}
function seatNumberToContractSeat(seatNumber) {
    return Math.max(seatNumber - 1, 0);
}
function normalizeSectionName(sectionName) {
    return sectionName.toLowerCase().replace(/\s+/g, ' ').trim();
}
function getContractSectionTier(sectionName) {
    return sectionTierByName.get(normalizeSectionName(sectionName)) ?? null;
}
async function loadSeatRecords() {
    return prisma.seat.findMany({
        include: {
            section: {
                select: { name: true },
            },
        },
    });
}
function shouldPreserveLock(seat) {
    return seat.status === 'LOCKED' && seat.lockedUntil !== null && seat.lockedUntil > new Date();
}
async function syncSeatChunk(seats) {
    const contracts = seats.map((seat) => {
        const tier = getContractSectionTier(seat.section.name);
        return {
            seat,
            tier,
            args: tier
                ? [BigInt(1), BigInt(tier), BigInt(rowLabelToContractRow(seat.rowNumber)), BigInt(seatNumberToContractSeat(seat.seatNumber))]
                : null,
        };
    });
    const queryable = contracts.filter((item) => Boolean(item.args));
    const results = queryable.length > 0
        ? await Promise.all(queryable.map((item) => publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: seatAbi,
            functionName: 'getSeatByIndex',
            args: item.args,
        })))
        : [];
    const updates = queryable.flatMap((item, index) => {
        const seatState = results[index];
        const onChainReserved = seatState?.isReserved ?? false;
        const desiredStatus = onChainReserved
            ? 'SOLD'
            : shouldPreserveLock(item.seat)
                ? 'LOCKED'
                : 'AVAILABLE';
        const desiredWallet = onChainReserved
            ? item.seat.walletAddress ?? null
            : shouldPreserveLock(item.seat)
                ? item.seat.walletAddress
                : null;
        const desiredLockedUntil = desiredStatus === 'LOCKED' ? item.seat.lockedUntil : null;
        if (item.seat.status === desiredStatus &&
            item.seat.walletAddress === desiredWallet &&
            ((item.seat.lockedUntil === null && desiredLockedUntil === null) ||
                item.seat.lockedUntil?.getTime() === desiredLockedUntil?.getTime())) {
            return [];
        }
        return [
            prisma.seat.update({
                where: { id: item.seat.id },
                data: {
                    status: desiredStatus,
                    walletAddress: desiredWallet,
                    lockedUntil: desiredLockedUntil,
                },
            }),
        ];
    });
    await Promise.all(updates);
}
export async function syncContractState(force = false) {
    const now = Date.now();
    if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) {
        return;
    }
    if (syncInFlight) {
        await syncInFlight;
        return;
    }
    syncInFlight = (async () => {
        try {
            const seats = await loadSeatRecords();
            for (let index = 0; index < seats.length; index += BATCH_SIZE) {
                const chunk = seats.slice(index, index + BATCH_SIZE);
                await syncSeatChunk(chunk);
            }
            lastSyncAt = Date.now();
        }
        catch (error) {
            console.error('[ContractSync] Failed to reconcile seat state:', error);
        }
        finally {
            syncInFlight = null;
        }
    })();
    await syncInFlight;
}
export function startContractSyncWorker() {
    void syncContractState(true);
    if (syncTimer) {
        return;
    }
    syncTimer = setInterval(() => {
        void syncContractState();
    }, SYNC_INTERVAL_MS);
}
export function stopContractSyncWorker() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}
