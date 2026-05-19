const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');

router.get('/verification', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const data = await ReportService.generateVerificationReport({
      startDate: start_date,
      endDate: end_date
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/appointment', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const data = await ReportService.generateAppointmentReport({
      startDate: start_date,
      endDate: end_date
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/blacklist', async (req, res) => {
  try {
    const data = await ReportService.generateBlacklistReport({ is_active: true });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const report = await ReportService.generateDailyReport(date);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/export/verification', async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    const result = await ReportService.exportVerificationReport(start_date, end_date);
    
    if (result.success) {
      res.json({ success: true, message: '导出成功', filename: result.filename });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/export/appointment', async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    const result = await ReportService.exportAppointmentReport(start_date, end_date);
    
    if (result.success) {
      res.json({ success: true, message: '导出成功', filename: result.filename });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/export/blacklist', async (req, res) => {
  try {
    const result = await ReportService.exportBlacklistReport();
    
    if (result.success) {
      res.json({ success: true, message: '导出成功', filename: result.filename });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

module.exports = router;
