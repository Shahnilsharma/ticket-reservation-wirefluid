import 'dotenv/config';
import prisma from './services/db.js';
const STADIUM_NAME = 'National Cricket Stadium';
const STADIUM_LOCATION = 'Karachi, Pakistan';
const SEATS_PER_FULL_ROW = 20;
const SECTION_CONFIGS = [
    { id: 'north', name: 'North Stand', basePrice: 0.025, seatTarget: 1667 },
    { id: 'north-east', name: 'North-East Stand', basePrice: 0.022, seatTarget: 1667 },
    { id: 'south-east', name: 'South-East Stand', basePrice: 0.018, seatTarget: 1667 },
    { id: 'south', name: 'South Stand', basePrice: 0.02, seatTarget: 1667 },
    { id: 'south-west', name: 'South-West Stand', basePrice: 0.019, seatTarget: 1666 },
    { id: 'north-west', name: 'North-West Stand', basePrice: 0.021, seatTarget: 1666 },
];
function getRowLabel(index) {
    let label = '';
    let curr = index;
    do {
        label = String.fromCharCode(65 + (curr % 26)) + label;
        curr = Math.floor(curr / 26) - 1;
    } while (curr >= 0);
    return label;
}
function rowSeatCounts(target) {
    const fullRows = Math.floor(target / SEATS_PER_FULL_ROW);
    const remainder = target % SEATS_PER_FULL_ROW;
    const counts = Array.from({ length: fullRows }, () => SEATS_PER_FULL_ROW);
    if (remainder > 0)
        counts.push(remainder);
    return counts;
}
async function seed() {
    const expectedTotal = SECTION_CONFIGS.reduce((sum, section) => sum + section.seatTarget, 0);
    if (expectedTotal !== 10_000) {
        throw new Error(`Invalid config total: ${expectedTotal}. Expected exactly 10000.`);
    }
    console.log('Resetting existing stadium data...');
    await prisma.seat.deleteMany();
    await prisma.section.deleteMany();
    await prisma.stadium.deleteMany();
    console.log('Creating stadium...');
    const stadium = await prisma.stadium.create({
        data: {
            name: STADIUM_NAME,
            location: STADIUM_LOCATION,
        },
    });
    let inserted = 0;
    for (const section of SECTION_CONFIGS) {
        const createdSection = await prisma.section.create({
            data: {
                name: section.name,
                stadiumId: stadium.id,
            },
        });
        const counts = rowSeatCounts(section.seatTarget);
        const seatRowsTotal = counts.length;
        const seats = counts.flatMap((seatCount, rowIndex) => {
            const rowLabel = getRowLabel(rowIndex);
            const premiumFactor = 1 + (seatRowsTotal - rowIndex) * 0.01;
            const price = Number((section.basePrice * premiumFactor).toFixed(4));
            return Array.from({ length: seatCount }, (_, seatIndex) => ({
                rowNumber: rowLabel,
                seatNumber: seatIndex + 1,
                price,
                status: 'AVAILABLE',
                sectionId: createdSection.id,
            }));
        });
        await prisma.seat.createMany({ data: seats });
        inserted += seats.length;
        console.log(`Section "${section.name}" seeded with ${seats.length} seats (${counts.length - 1} full rows + ${counts[counts.length - 1]} seats in final row).`);
    }
    const dbTotal = await prisma.seat.count();
    console.log(`Seeding complete. Inserted ${inserted} seats, DB reports ${dbTotal} seats.`);
}
seed()
    .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
