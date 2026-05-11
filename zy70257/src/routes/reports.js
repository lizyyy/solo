const express = require('express');
const router = express.Router();
const Report = require('../models/report');
const Responsibility = require('../models/responsibility');
const { success } = require('../utils/response');

router.get('/overview', async (req, res) => {
  const stats = await Report.getOverallStats();
  res.json(success(stats, '获取总体统计成功'));
});

router.get('/responsibility', async (req, res) => {
  const report = await Report.getResponsibilityReport();
  res.json(success(report, '获取责任归因报表成功'));
});

router.get('/responsibility-stats', async (req, res) => {
  const stats = await Responsibility.getStatistics();
  res.json(success(stats, '获取责任归因统计成功'));
});

router.get('/prescription/:prescriptionId/history', async (req, res) => {
  const history = await Report.getPrescriptionReturnHistory(req.params.prescriptionId);
  res.json(success(history, '获取处方返修历史成功'));
});

module.exports = router;
