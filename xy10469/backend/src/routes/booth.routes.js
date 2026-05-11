const express = require('express');
const router = express.Router();
const boothController = require('../controllers/booth.controller');

router.get('/', boothController.getAllBooths);
router.post('/', boothController.createBooth);
router.post('/check-availability', boothController.checkBoothAvailability);
router.get('/:id', boothController.getBoothById);
router.put('/:id', boothController.updateBooth);
router.delete('/:id', boothController.deleteBooth);
router.get('/:id/calendar', boothController.getBoothCalendar);

module.exports = router;