import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
export declare function initSocketServer(httpServer: HttpServer): Server;
export declare function getSocketServer(): Server | null;
//# sourceMappingURL=socket.d.ts.map