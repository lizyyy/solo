const express = require('express');
const router = express.Router();
const dutyScheduleController = require('../controllers/dutyScheduleController');

router.post('/', dutyScheduleController.createSchedule);
router.get('/', dutyScheduleController.getSchedules);
router.get('/today', dutyScheduleController.getTodayDuty);
router.put('/:id', dutyScheduleController.updateSchedule);

module.exports = router;
