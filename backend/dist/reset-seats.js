import 'dotenv/config';
import prisma from './services/db.js';
async function resetSeats() {
    const before = await prisma.seat.groupBy({
        by: ['status'],
        _count: { _all: true },
    });
    const resetResult = await prisma.seat.updateMany({
        where: {
            OR: [{ status: 'LOCKED' }, { status: 'SOLD' }],
        },
        data: {
            status: 'AVAILABLE',
            lockedUntil: null,
            walletAddress: null,
        },
    });
    const after = await prisma.seat.groupBy({
        by: ['status'],
        _count: { _all: true },
    });
    const format = (rows) => rows
        .map((row) => `${row.status}: ${row._count._all}`)
        .sort()
        .join(', ');
    console.log(`Reset ${resetResult.count} seats (LOCKED/SOLD -> AVAILABLE).`);
    console.log(`Before: ${format(before)}.`);
    console.log(`After: ${format(after)}.`);
}
resetSeats()
    .catch((error) => {
    console.error('Seat reset failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
