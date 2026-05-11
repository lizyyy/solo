const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, appointmentController.createAppointment);
router.get('/', authenticateToken, appointmentController.getAppointments);
router.get('/:id', authenticateToken, appointmentController.getAppointmentById);
router.put('/:id', authenticateToken, requireRole(['admin', 'approver']), appointmentController.updateAppointment);
router.post('/:id/cancel', authenticateToken, appointmentController.cancelAppointment);

module.exports = router;
