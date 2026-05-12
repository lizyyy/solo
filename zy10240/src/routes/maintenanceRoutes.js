const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');

router.post('/', maintenanceController.createTask);
router.get('/', maintenanceController.getAllTasks);
router.get('/:id', maintenanceController.getTask);
router.get('/:id/history', maintenanceController.getTaskHistory);
router.post('/:id/start', maintenanceController.startTask);
router.post('/:id/complete', maintenanceController.completeTask);
router.post('/:id/needs-repotting', maintenanceController.markNeedsRepotting);
router.post('/:id/needs-compensation', maintenanceController.markNeedsCompensation);
router.post('/:id/cancel', maintenanceController.cancelTask);

module.exports = router;
