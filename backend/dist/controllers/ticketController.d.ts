import type { Request, Response, NextFunction } from 'express';
export declare const getSections: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSectionSeats: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 2. Atomic "Soft-Lock" Controller
 * Uses Postgres atomic find-and-update to prevent race conditions.
 */
export declare const lockSeat: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const unlockSeat: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 3. NFT Metadata Endpoint
 * Provides dynamic ERC-721 JSON attributes.
 */
export declare const getTicketMetadata: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 4. Purchase Confirmation Webhook
 * Permanently locks the seat after a successful blockchain transaction.
 */
export declare const confirmPurchase: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 5. Secure QR Logic (Entry Verification)
 * This endpoint illustrates standard signature verification.
 */
export declare const verifyEntry: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=ticketController.d.ts.map