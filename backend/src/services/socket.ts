import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join_section', (sectionId: string) => {
      if (!sectionId) return;
      socket.join(`section:${sectionId}`);
    });

    socket.on('leave_section', (sectionId: string) => {
      if (!sectionId) return;
      socket.leave(`section:${sectionId}`);
    });
  });

  return io;
}

export function getSocketServer(): Server | null {
  return io;
}
