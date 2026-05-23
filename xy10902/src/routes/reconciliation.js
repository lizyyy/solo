const express = require('express');
const router = express.Router();
const path = require('path');
const ReconciliationService = require('../services/ReconciliationService');
const ReconciliationSummary = require('../models/ReconciliationSummary');
const ExceptionLog = require('../models/ExceptionLog');

router.post('/summary', async (req, res) => {
  try {
    const { date } = req.body;
    const summary = await ReconciliationService.generateSummary(date || new Date());

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'generate_summary_error',
      raw_input: req.body,
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/summary/list', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.query,
        error_message: '缺少日期范围参数',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '缺少日期范围参数'
      });
    }

    const summaries = await ReconciliationSummary.listByDateRange(start_date, end_date);

    res.json({
      success: true,
      data: summaries
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'list_summary_error',
      raw_input: req.query,
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/summary/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const summary = await ReconciliationSummary.findByDate(date);

    if (!summary) {
      await ExceptionLog.create({
        exception_type: 'summary_not_found',
        raw_input: { date },
        error_message: '对账摘要不存在',
        processing_result: '返回404错误',
        api_path: req.path
      });
      return res.status(404).json({
        success: false,
        error: '对账摘要不存在'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'get_summary_error',
      raw_input: req.params,
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { start_date, end_date, export_path } = req.body;

    if (!start_date || !end_date) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.body,
        error_message: '缺少日期范围参数',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '缺少日期范围参数'
      });
    }

    const defaultPath = path.join(__dirname, '../../exports/reconciliation.csv');
    const result = await ReconciliationService.exportToCsv(
      start_date,
      end_date,
      export_path || defaultPath
    );

    res.json(result);
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'export_csv_error',
      raw_input: req.body,
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/correct', async (req, res) => {
  try {
    const { deduction_no, new_amount, reason, operator } = req.body;

    if (!deduction_no || new_amount === undefined || !reason || !operator) {
      await ExceptionLog.create({
        exception_type: 'param_validation_error',
        raw_input: req.body,
        error_message: '缺少必要参数: deduction_no, new_amount, reason, operator',
        processing_result: '返回400错误',
        api_path: req.path
      });
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const result = await ReconciliationService.manualCorrect(
      deduction_no,
      new_amount,
      reason,
      operator
    );

    res.json(result);
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'manual_correct_error',
      raw_input: req.body,
      error_message: error.message,
      processing_result: '返回400错误',
      api_path: req.path
    });

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
