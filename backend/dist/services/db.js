import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("❌ DATABASE_URL is not set in the .env file.");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
// Initialize PrismaClient for Postgres via Prisma 7 Adapter
const prisma = new PrismaClient({ adapter });
export default prisma;
