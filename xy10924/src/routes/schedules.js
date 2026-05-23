const express = require('express');
const router = express.Router();
const trialScheduleService = require('../services/trialScheduleService');

router.post('/', async (req, res) => {
  try {
    const schedule = await trialScheduleService.createSchedule(req.body);
    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const schedules = await trialScheduleService.getAllSchedules(req.query);
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const schedule = await trialScheduleService.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: '试工安排不存在' });
    }
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/details', async (req, res) => {
  try {
    const schedule = await trialScheduleService.getScheduleWithDetails(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: '试工安排不存在' });
    }
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const schedule = await trialScheduleService.updateScheduleStatus(req.params.id, status, req.body);
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/correct', async (req, res) => {
  try {
    const schedule = await trialScheduleService.manualCorrect(
      req.params.id,
      req.body,
      req.body.operator || 'system'
    );
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
