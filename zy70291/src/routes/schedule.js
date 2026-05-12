const express = require('express');
const scheduleService = require('../services/scheduleService');
const { handleAsync } = require('../utils/errors');

const router = express.Router();

router.get('/generate', handleAsync(async (req, res) => {
  const craneId = req.query.crane_id;
  const windSpeed = req.query.wind_speed != null ? Number(req.query.wind_speed) : null;
  
  const schedule = scheduleService.generateSchedule(craneId, windSpeed);
  res.json({ data: schedule });
}));

router.get('/summary', handleAsync(async (req, res) => {
  const summary = scheduleService.getScheduleSummary(req.query.crane_id);
  res.json({ data: summary });
}));

router.get('/review-panel', handleAsync(async (req, res) => {
  const panel = scheduleService.getReviewPanel(req.query.crane_id);
  res.json({ data: panel });
}));

module.exports = router;
