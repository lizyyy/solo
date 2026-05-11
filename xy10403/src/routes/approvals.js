const express = require('express');
const approvalController = require('../controllers/approvalController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/:id/approve', authenticateToken, requireRole(['admin', 'approver']), approvalController.approveAppointment);
router.post('/:id/reject', authenticateToken, requireRole(['admin', 'approver']), approvalController.rejectAppointment);

module.exports = router;
