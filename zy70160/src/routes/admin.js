const express = require('express');
const router = express.Router();
const { SLAService } = require('../services/slaService');
const moment = require('moment');

// 手动触发超时检查
router.post('/check-escalations', async (req, res) => {
  try {
    const result = await SLAService.checkAndEscalate();
    res.json({
      success: true,
      message: `检查完成，已升级 ${result.count} 个工单`,
      details: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 生成报表
router.get('/reports', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // 默认时间范围：最近30天
    const end = endDate ? moment(endDate) : moment();
    const start = startDate ? moment(startDate) : moment().subtract(30, 'days');
    
    const report = await SLAService.generateReport(
      start.format('YYYY-MM-DD HH:mm:ss'),
      end.format('YYYY-MM-DD HH:mm:ss')
    );
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 系统状态
router.get('/status', (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: moment().format()
  });
});

module.exports = router;
