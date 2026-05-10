const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const logger = require('../logger');

router.get('/logs', (req, res) => {
  try {
    const params = {
      operator_id: req.query.operator_id,
      operation_type: req.query.operation_type,
      target_type: req.query.target_type,
      target_id: req.query.target_id,
      result: req.query.result,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      page: parseInt(req.query.page) || 1,
      page_size: parseInt(req.query.page_size) || 100
    };

    const result = auditService.query(params);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error('查询审计日志失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询审计日志失败',
      detail: err.message
    });
  }
});

router.get('/logs/:logId', (req, res) => {
  try {
    const log = auditService.getLogDetail(parseInt(req.params.logId));
    if (!log) {
      return res.status(404).json({
        success: false,
        error: '审计日志不存在'
      });
    }
    res.json({
      success: true,
      data: log
    });
  } catch (err) {
    logger.error('查询审计日志详情失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询审计日志详情失败',
      detail: err.message
    });
  }
});

router.get('/refund-timeline/:refundRequestId', (req, res) => {
  try {
    const timeline = auditService.getRefundTimeline(req.params.refundRequestId);
    res.json({
      success: true,
      data: {
        refund_request_id: req.params.refundRequestId,
        timeline
      }
    });
  } catch (err) {
    logger.error('查询退款时间线失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询退款时间线失败',
      detail: err.message
    });
  }
});

router.get('/override-attempts', (req, res) => {
  try {
    const result = auditService.getOverrideAttempts(
      req.query.start_time,
      req.query.end_time,
      parseInt(req.query.page) || 1,
      parseInt(req.query.page_size) || 50
    );

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error('查询越权尝试记录失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询越权尝试记录失败',
      detail: err.message
    });
  }
});

router.get('/daily-report', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const report = auditService.generateDailyReport(date);

    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    logger.error('生成日报失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '生成日报失败',
      detail: err.message
    });
  }
});

module.exports = router;
