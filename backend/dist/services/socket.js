import { Server } from 'socket.io';
let io = null;
export function initSocketServer(httpServer) {
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
        socket.on('join_section', (sectionId) => {
            if (!sectionId)
                return;
            socket.join(`section:${sectionId}`);
        });
        socket.on('leave_section', (sectionId) => {
            if (!sectionId)
                return;
            socket.leave(`section:${sectionId}`);
        });
    });
    return io;
}
export function getSocketServer() {
    return io;
}
