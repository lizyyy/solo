const express = require('express');
const gateController = require('../controllers/gateController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, gateController.getGates);
router.post('/checkin', authenticateToken, requireRole(['admin', 'gate']), gateController.checkin);
router.post('/checkout', authenticateToken, requireRole(['admin', 'gate']), gateController.checkout);

module.exports = router;
