import { Router } from 'express';
import { lockSeat, unlockSeat, getTicketMetadata, confirmPurchase, verifyEntry, getSections, getSectionSeats, getBookings, } from '../controllers/ticketController.js';
const router = Router();
// Bookings per wallet
router.get('/bookings', getBookings);
// 2. Atomic Soft Lock
router.post('/lock', lockSeat);
router.post('/unlock', unlockSeat);
// Section list + seat inventory
router.get('/sections', getSections);
router.get('/sections/:clientId/seats', getSectionSeats);
// 3. NFT Metadata Endpoint
router.get('/:id', getTicketMetadata);
// 4. Purchase Confirmation Webhook
router.post('/confirm-purchase', confirmPurchase);
// 5. Entry Verification
router.post('/verify-entry', verifyEntry);
// Generic Test endpoint
router.get('/', (req, res) => {
    res.json({ message: 'Ticket system is functional' });
});
export default router;
