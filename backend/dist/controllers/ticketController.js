import { verifyMessage } from 'viem';
import prisma from '../services/db.js';
import { getSocketServer } from '../services/socket.js';
import { syncContractState } from '../services/contract-sync.js';
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const getBookings = async (req, res, next) => {
    const { walletAddress } = req.query;
    if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'walletAddress query parameter is required' });
    }
    try {
        void syncContractState();
        const bookings = await prisma.seat.findMany({
            where: {
                walletAddress: walletAddress.toLowerCase(),
                status: 'SOLD',
            },
            include: {
                section: {
                    include: {
                        stadium: true,
                    },
                },
            },
            orderBy: {
                id: 'desc',
            },
        });
        return res.status(200).json({
            bookings: bookings.map((seat) => ({
                id: seat.id,
                rowNumber: seat.rowNumber,
                seatNumber: seat.seatNumber,
                price: seat.price,
                section: {
                    id: seat.section.id,
                    name: seat.section.name,
                    stadium: seat.section.stadium.name,
                },
                bookedAt: seat.updatedAt,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
function toSectionClientId(sectionName) {
    const normalized = sectionName.toLowerCase().replace(/\s+stand$/, '').replace(/\s+/g, '-');
    if (normalized === 'north' ||
        normalized === 'north-east' ||
        normalized === 'south-east' ||
        normalized === 'south' ||
        normalized === 'south-west' ||
        normalized === 'north-west') {
        return normalized;
    }
    return null;
}
function toClientSeatStatus(status) {
    return status.toLowerCase();
}
function isValidWalletAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}
async function releaseExpiredLocks(sectionId) {
    const now = new Date();
    const where = {
        status: 'LOCKED',
        lockedUntil: { lt: now },
        ...(sectionId ? { sectionId } : {}),
    };
    const expiredSeats = await prisma.seat.findMany({
        where,
        select: {
            id: true,
            sectionId: true,
        },
    });
    if (expiredSeats.length === 0) {
        return [];
    }
    await prisma.seat.updateMany({
        where: { id: { in: expiredSeats.map((seat) => seat.id) } },
        data: {
            status: 'AVAILABLE',
            lockedUntil: null,
            walletAddress: null,
        },
    });
    const io = getSocketServer();
    expiredSeats.forEach((seat) => {
        io?.emit('seat.unlocked', {
            seatId: seat.id,
            sectionId: seat.sectionId,
            status: 'AVAILABLE',
        });
        io?.to(`section:${seat.sectionId}`).emit('section.seat.unlocked', {
            seatId: seat.id,
            sectionId: seat.sectionId,
            status: 'AVAILABLE',
        });
    });
    return expiredSeats;
}
export const getSections = async (req, res, next) => {
    try {
        void syncContractState();
        await releaseExpiredLocks();
        const sections = await prisma.section.findMany({
            include: { stadium: true },
            orderBy: { name: 'asc' },
        });
        const grouped = await prisma.seat.groupBy({
            by: ['sectionId', 'status'],
            _count: { _all: true },
        });
        const groupedMap = new Map();
        for (const item of grouped) {
            const current = groupedMap.get(item.sectionId) ?? { available: 0, locked: 0, sold: 0 };
            if (item.status === 'AVAILABLE')
                current.available = item._count._all;
            if (item.status === 'LOCKED')
                current.locked = item._count._all;
            if (item.status === 'SOLD')
                current.sold = item._count._all;
            groupedMap.set(item.sectionId, current);
        }
        const response = sections
            .map((section) => {
            const clientId = toSectionClientId(section.name);
            if (!clientId)
                return null;
            const counts = groupedMap.get(section.id) ?? { available: 0, locked: 0, sold: 0 };
            return {
                id: section.id,
                clientId,
                name: section.name,
                stadium: {
                    id: section.stadium.id,
                    name: section.stadium.name,
                    location: section.stadium.location,
                },
                counts,
                totalSeats: counts.available + counts.locked + counts.sold,
            };
        })
            .filter(Boolean);
        return res.status(200).json({ sections: response });
    }
    catch (error) {
        next(error);
    }
};
export const getSectionSeats = async (req, res, next) => {
    const { clientId } = req.params;
    try {
        void syncContractState();
        const sections = await prisma.section.findMany({
            include: { stadium: true },
        });
        const matchedSection = sections.find((section) => toSectionClientId(section.name) === clientId);
        if (!matchedSection) {
            return res.status(404).json({ error: 'Section not found' });
        }
        await releaseExpiredLocks(matchedSection.id);
        const seats = await prisma.seat.findMany({
            where: { sectionId: matchedSection.id },
            orderBy: [{ rowNumber: 'asc' }, { seatNumber: 'asc' }],
        });
        return res.status(200).json({
            section: {
                id: matchedSection.id,
                clientId,
                name: matchedSection.name,
            },
            seats: seats.map((seat) => ({
                id: seat.id,
                rowNumber: seat.rowNumber,
                seatNumber: seat.seatNumber,
                price: seat.price,
                status: toClientSeatStatus(seat.status),
                lockedUntil: seat.lockedUntil,
                walletAddress: seat.walletAddress,
                sectionId: seat.sectionId,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * 2. Atomic "Soft-Lock" Controller
 * Uses Postgres atomic find-and-update to prevent race conditions.
 */
export const lockSeat = async (req, res, next) => {
    const { seatId, walletAddress } = req.body;
    if (!seatId || !walletAddress) {
        return res.status(400).json({ error: 'seatId and walletAddress are required' });
    }
    if (!isValidWalletAddress(walletAddress)) {
        return res.status(400).json({ error: 'Invalid walletAddress format.' });
    }
    try {
        void syncContractState();
        await releaseExpiredLocks();
        const now = new Date();
        const lockedUntilTime = new Date(now.getTime() + LOCK_DURATION_MS);
        const normalizedWalletAddress = walletAddress.toLowerCase();
        // Atomic update with idempotent lock renewal:
        // - AVAILABLE seat can be locked.
        // - Expired LOCKED seat can be re-locked.
        // - Same wallet can renew its own unexpired LOCKED seat.
        // updateMany guarantees atomicity and prevents race conditions if multiple users click at exact same MS.
        const lockResult = await prisma.seat.updateMany({
            where: {
                id: seatId,
                OR: [
                    { status: 'AVAILABLE' },
                    {
                        status: 'LOCKED',
                        lockedUntil: { lt: now } // Existing lock expired
                    },
                    {
                        status: 'LOCKED',
                        lockedUntil: { gte: now },
                        walletAddress: normalizedWalletAddress,
                    },
                ]
            },
            data: {
                status: 'LOCKED',
                lockedUntil: lockedUntilTime,
                walletAddress: normalizedWalletAddress,
            }
        });
        if (lockResult.count === 0) {
            return res.status(409).json({ error: 'Seat is already locked or sold by another user.' });
        }
        // Retrieve minimal fields only for response/event payload.
        const lockedSeat = await prisma.seat.findUnique({
            where: { id: seatId },
            select: {
                id: true,
                sectionId: true,
                status: true,
                walletAddress: true,
                lockedUntil: true,
            },
        });
        if (lockedSeat) {
            const io = getSocketServer();
            io?.emit('seat.locked', {
                seatId: lockedSeat.id,
                sectionId: lockedSeat.sectionId,
                walletAddress: lockedSeat.walletAddress,
                lockedUntil: lockedSeat.lockedUntil,
                status: lockedSeat.status,
            });
            io?.to(`section:${lockedSeat.sectionId}`).emit('section.seat.locked', {
                seatId: lockedSeat.id,
                sectionId: lockedSeat.sectionId,
                walletAddress: lockedSeat.walletAddress,
                lockedUntil: lockedSeat.lockedUntil,
                status: lockedSeat.status,
            });
        }
        return res.status(200).json({ message: 'Seat locked successfully', seat: lockedSeat });
    }
    catch (error) {
        next(error);
    }
};
export const unlockSeat = async (req, res, next) => {
    const { seatId, walletAddress } = req.body;
    if (!seatId || !walletAddress) {
        return res.status(400).json({ error: 'seatId and walletAddress are required' });
    }
    if (!isValidWalletAddress(walletAddress)) {
        return res.status(400).json({ error: 'Invalid walletAddress format.' });
    }
    try {
        const normalizedWalletAddress = walletAddress.toLowerCase();
        const seat = await prisma.seat.findUnique({
            where: { id: seatId },
            select: {
                id: true,
                sectionId: true,
                status: true,
                walletAddress: true,
            },
        });
        if (!seat) {
            return res.status(404).json({ error: 'Seat not found.' });
        }
        if (seat.status === 'SOLD') {
            return res.status(409).json({ error: 'Sold seats cannot be unlocked.' });
        }
        if (seat.status === 'AVAILABLE') {
            return res.status(200).json({ message: 'Seat already unlocked.' });
        }
        if ((seat.walletAddress ?? '').toLowerCase() !== normalizedWalletAddress) {
            return res.status(409).json({ error: 'Seat is locked by another wallet.' });
        }
        const unlockResult = await prisma.seat.updateMany({
            where: {
                id: seatId,
                walletAddress: normalizedWalletAddress,
                status: 'LOCKED',
            },
            data: {
                status: 'AVAILABLE',
                lockedUntil: null,
                walletAddress: null,
            },
        });
        if (unlockResult.count === 0) {
            return res.status(409).json({ error: 'Seat unlock precondition failed.' });
        }
        const unlockedSeat = await prisma.seat.findUnique({
            where: { id: seatId },
        });
        if (unlockedSeat) {
            const io = getSocketServer();
            io?.emit('seat.unlocked', {
                seatId: unlockedSeat.id,
                sectionId: unlockedSeat.sectionId,
                status: unlockedSeat.status,
            });
            io?.to(`section:${unlockedSeat.sectionId}`).emit('section.seat.unlocked', {
                seatId: unlockedSeat.id,
                sectionId: unlockedSeat.sectionId,
                status: unlockedSeat.status,
            });
        }
        return res.status(200).json({ message: 'Seat unlocked successfully' });
    }
    catch (error) {
        next(error);
    }
};
/**
 * 3. NFT Metadata Endpoint
 * Provides dynamic ERC-721 JSON attributes.
 */
export const getTicketMetadata = async (req, res, next) => {
    const { id } = req.params;
    try {
        const seat = await prisma.seat.findUnique({
            where: { id: id },
            include: { section: { include: { stadium: true } } }
        });
        if (!seat) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        return res.status(200).json({
            name: `Ticket | ${seat.section.stadium.name} - ${seat.section.name}`,
            description: `Official NFT Ticket for ${seat.section.stadium.name}. Section: ${seat.section.name}, Row: ${seat.rowNumber}, Seat: ${seat.seatNumber}.`,
            image: 'ipfs://QmdummyStadiumCIDimageHashData',
            attributes: [
                { trait_type: 'Stadium', value: seat.section.stadium.name },
                { trait_type: 'Stand Name', value: seat.section.name },
                { trait_type: 'Row', value: seat.rowNumber },
                { trait_type: 'Seat Number', value: seat.seatNumber.toString() },
                { trait_type: 'Status', value: seat.status }
            ]
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * 4. Purchase Confirmation Webhook
 * Permanently locks the seat after a successful blockchain transaction.
 */
export const confirmPurchase = async (req, res, next) => {
    const { seatId, seatIds, txHash, walletAddress } = req.body;
    if ((!seatId && (!seatIds || !Array.isArray(seatIds))) || !txHash || !walletAddress) {
        return res.status(400).json({ error: 'seatId (or seatIds array), txHash and walletAddress are required' });
    }
    if (!isValidWalletAddress(walletAddress)) {
        return res.status(400).json({ error: 'Invalid walletAddress format.' });
    }
    const idsToConfirm = seatIds || [seatId];
    try {
        void syncContractState();
        const normalizedWalletAddress = walletAddress.toLowerCase();
        const confirmResult = await prisma.seat.updateMany({
            where: {
                id: { in: idsToConfirm },
                walletAddress: normalizedWalletAddress,
                status: { in: ['LOCKED', 'SOLD'] },
            },
            data: {
                status: 'SOLD',
                lockedUntil: null,
                walletAddress: normalizedWalletAddress,
            }
        });
        if (confirmResult.count === 0) {
            return res.status(400).json({
                error: 'Failed to confirm purchase. Seats are no longer locked by you or were never locked.'
            });
        }
        const soldSeats = await prisma.seat.findMany({
            where: { id: { in: idsToConfirm } },
            include: { section: { include: { stadium: true } } }
        });
        const io = getSocketServer();
        for (const soldSeat of soldSeats) {
            io?.emit('seat.sold', {
                seatId: soldSeat.id,
                sectionId: soldSeat.sectionId,
                walletAddress: soldSeat.walletAddress,
                status: soldSeat.status,
            });
            io?.to(`section:${soldSeat.sectionId}`).emit('section.seat.sold', {
                seatId: soldSeat.id,
                sectionId: soldSeat.sectionId,
                walletAddress: soldSeat.walletAddress,
                status: soldSeat.status,
            });
        }
        return res.status(200).json({ message: 'Purchase confirmed seamlessly!', confirmedCount: confirmResult.count });
    }
    catch (error) {
        next(error);
    }
};
/**
 * 5. Secure QR Logic (Entry Verification)
 * This endpoint illustrates standard signature verification.
 */
export const verifyEntry = async (req, res, next) => {
    const { signature, message, walletAddress, seatId } = req.body;
    try {
        // 1. Recover the signer address from the provided signature and message using Viem
        const isValidSignature = await verifyMessage({
            address: walletAddress.toLowerCase(),
            message: message, // Example: "Verify entry for Seat ID 1234 at Timestamp 1700000000"
            signature: signature,
        });
        if (!isValidSignature) {
            return res.status(401).json({ error: 'Invalid crypto signature' });
        }
        // 2. Fetch the seat from DB to cross-reference constraints
        const seat = await prisma.seat.findUnique({
            where: { id: seatId }
        });
        if (!seat || seat.status !== 'SOLD') {
            return res.status(404).json({ error: 'Ticket invalid or not sold' });
        }
        // Optional Security: Verify if `walletAddress` matches the DB owner 
        // BUT true web3 ticketing involves trading, so it's strictly better to query 
        // the smart contract to see who *currently* owns the NFT on-chain:
        /*
          const publicClient = createPublicClient({ chain: mainnet, transport: http() });
          const currentOwner = await publicClient.readContract({
            address: NFT_CONTRACT_ADDRESS,
            abi: erc721ABI,
            functionName: 'ownerOf',
            args: [seat.tokenId] // Assuming you stored `tokenId` on the Seat model
          });
    
          if (currentOwner.toLowerCase() !== walletAddress.toLowerCase()) {
             return res.status(403).json({ error: 'Signer does not own this ticket on-chain.' });
          }
        */
        return res.status(200).json({ valid: true, message: 'Valid Entry, access granted!' });
    }
    catch (error) {
        next(error);
    }
};
