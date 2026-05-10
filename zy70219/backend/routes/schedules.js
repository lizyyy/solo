const express = require('express');
const router = express.Router();
const scheduleService = require('../services/scheduleService');

router.get('/cleaning', async (req, res) => {
  try {
    const { kitchen_id } = req.query;
    const cleanings = await scheduleService.getCleaningWindows(kitchen_id);
    res.json(cleanings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cleaning', async (req, res) => {
  try {
    const { kitchen_id, start_time, end_time, operator } = req.body;
    if (!kitchen_id || !start_time || !end_time) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const id = await scheduleService.createCleaningWindow({
      kitchen_id,
      start_time,
      end_time,
      operator
    });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cleaning/:id/status', async (req, res) => {
  try {
    const { status, operator } = req.body;
    if (!status) {
      return res.status(400).json({ error: '状态不能为空' });
    }
    
    await scheduleService.updateCleaningWindowStatus(
      req.params.id,
      status,
      operator || 'admin'
    );
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('不存在')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/fire-inspections', async (req, res) => {
  try {
    const { kitchen_id } = req.query;
    const inspections = await scheduleService.getFireInspections(kitchen_id);
    res.json(inspections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fire-inspections', async (req, res) => {
  try {
    const { kitchen_id, scheduled_time, inspector } = req.body;
    if (!kitchen_id || !scheduled_time) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const id = await scheduleService.createFireInspection({
      kitchen_id,
      scheduled_time,
      inspector
    });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fire-inspections/:id/status', async (req, res) => {
  try {
    const { status, result, operator } = req.body;
    if (!status) {
      return res.status(400).json({ error: '状态不能为空' });
    }
    
    await scheduleService.updateFireInspectionStatus(
      req.params.id,
      status,
      result || '',
      operator || 'admin'
    );
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('不存在')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
