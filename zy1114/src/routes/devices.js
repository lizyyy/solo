const express = require('express');
const router = express.Router();
const devicesController = require('../controllers/devicesController');

router.get('/', devicesController.getAllDevices);
router.get('/:id', devicesController.getDeviceById);
router.get('/:id/availability', devicesController.getDeviceAvailability);
router.post('/', devicesController.createDevice);
router.put('/:id', devicesController.updateDevice);
router.delete('/:id', devicesController.deleteDevice);

module.exports = router;
