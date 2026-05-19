const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', permissionMiddleware('ticket:create'), ticketController.createTicket);
router.get('/', permissionMiddleware('ticket:read'), ticketController.getTickets);
router.get('/statistics', permissionMiddleware('ticket:read'), ticketController.getStatistics);
router.get('/:id', permissionMiddleware('ticket:read'), ticketController.getTicketById);
router.put('/:id', permissionMiddleware('ticket:update'), ticketController.updateTicket);
router.post('/:id/classify', permissionMiddleware('ticket:classify'), ticketController.classifyTicketById);
router.post('/:id/review', permissionMiddleware('ticket:review'), ticketController.reviewTicket);

module.exports = router;
