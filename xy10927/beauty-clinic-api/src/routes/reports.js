const express = require('express');
const router = express.Router();
const ReportExceptionService = require('../services/ReportExceptionService');

router.get('/verifications', async (req, res) => {
  try {
    const { start_date, end_date, store_id } = req.query;
    const report = await ReportExceptionService.generateVerificationReport(start_date, end_date, store_id);
    res.json({
      success: true,
      status: 'completed',
      data: report
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/packages', async (req, res) => {
  try {
    const { store_id } = req.query;
    const report = await ReportExceptionService.generatePackageReport(store_id);
    res.json({
      success: true,
      status: 'completed',
      data: report
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/customer/:id', async (req, res) => {
  try {
    const info = await ReportExceptionService.getFullCustomerInfo(req.params.id);
    if (!info) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: '顾客不存在'
      });
    }
    res.json({
      success: true,
      status: 'completed',
      data: info
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const logs = await ReportExceptionService.getExceptionLogs(req.query);
    res.json({
      success: true,
      status: 'completed',
      data: logs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/exceptions/:id', async (req, res) => {
  try {
    const log = await ReportExceptionService.getExceptionLogById(req.params.id);
    if (!log) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: '异常日志不存在'
      });
    }
    res.json({
      success: true,
      status: 'completed',
      data: log
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/corrections', async (req, res) => {
  try {
    const corrections = await ReportExceptionService.getManualCorrections(req.query);
    res.json({
      success: true,
      status: 'completed',
      data: corrections
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/export/csv', async (req, res) => {
  try {
    const { data, fields } = req.body;
    const csv = await ReportExceptionService.exportToCSV(data, fields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
    res.send(csv);
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

module.exports = router;
