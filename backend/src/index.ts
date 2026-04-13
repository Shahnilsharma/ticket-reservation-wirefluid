import 'dotenv/config';
import http from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import ticketRoutes from './routes/ticketRoutes.js';
import prisma from './services/db.js';
import { initSocketServer } from './services/socket.js';
import { startContractSyncWorker, stopContractSyncWorker } from './services/contract-sync.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

// Middleware
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(morgan('dev'));

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/tickets', ticketRoutes);

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`\n[Error]: ${req.method} ${req.url}`);
  console.error(`Message: ${err.message}`);

  if (process.env.NODE_ENV !== 'production') {
    console.error(`Stack: ${err.stack}`);
  }

  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});

const server = http.createServer(app);
initSocketServer(server);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  stopContractSyncWorker();

  server.close(async () => {
    await prisma.$disconnect();
    console.log('Prisma disconnected: graceful shutdown complete.');
    process.exit(0);
  });

  setTimeout(async () => {
    await prisma.$disconnect();
    process.exit(1);
  }, 10_000).unref();
}

server.listen(port, async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    startContractSyncWorker();
    console.log("Successfully connected to the 'ticket_db' PostgreSQL database.");
    console.log(`Backend server started at http://localhost:${port}`);
    console.log('Socket.IO is enabled on the same host/port.');
  } catch (err) {
    console.error('Failed to connect to the database:', err);
    process.exit(1);
  }
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});