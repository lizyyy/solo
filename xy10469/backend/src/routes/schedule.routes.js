const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');

router.get('/', scheduleController.getAllSchedules);
router.post('/', scheduleController.createSchedule);
router.get('/:id', scheduleController.getScheduleById);
router.put('/:id', scheduleController.updateSchedule);
router.delete('/:id', scheduleController.deleteSchedule);

module.exports = router;