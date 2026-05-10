const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.get('/dashboard', async (req, res) => {
  try {
    const stats = await reportService.getDashboardStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/kitchen-utilization', async (req, res) => {
  try {
    const { kitchen_id } = req.query;
    const utilization = await reportService.getKitchenUtilization(kitchen_id);
    res.json(utilization);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/equipment-schedule', async (req, res) => {
  try {
    const { equipment_id } = req.query;
    const schedule = await reportService.getEquipmentSchedule(equipment_id);
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const { start_date, end_date, kitchen_id } = req.query;
    
    const today = new Date();
    const startDate = start_date || new Date(today).toISOString();
    const endDate = end_date || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const timeline = await reportService.getTimeline(startDate, endDate, kitchen_id);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conflict-report', async (req, res) => {
  try {
    const report = await reportService.getConflictReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
