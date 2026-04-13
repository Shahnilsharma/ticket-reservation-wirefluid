import 'dotenv/config';
import http from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import ticketRoutes from './routes/ticketRoutes.js';
import prisma from './services/db.js';
import { initSocketServer } from './services/socket.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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

server.listen(port, async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Successfully connected to the 'ticket_db' PostgreSQL database.");
    console.log(`Backend server started at http://localhost:${port}`);
    console.log('Socket.IO is enabled on the same host/port.');
  } catch (err) {
    console.error('Failed to connect to the database:', err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('\nPrisma disconnected: graceful shutdown complete.');
  process.exit();
});