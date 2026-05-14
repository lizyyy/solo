const express = require('express');
const ChartMetricModel = require('../models/ChartMetric');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const filters = {
      chart_code: req.query.chart_code,
      metric_name: req.query.metric_name,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const metrics = await ChartMetricModel.getMetrics(filters);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await ChartMetricModel.getStatistics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
