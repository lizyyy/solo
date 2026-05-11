const express = require('express');
const vehicleController = require('../controllers/vehicleController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/:appointment_id', authenticateToken, vehicleController.getVehicles);
router.post('/:appointment_id', authenticateToken, vehicleController.addVehicles);
router.delete('/:appointment_id/:vehicle_id', authenticateToken, vehicleController.removeVehicle);

module.exports = router;
