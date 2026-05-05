const express = require('express');
const router = express.Router();
const reconciliationService = require('../services/reconciliationService');
const auditReportService = require('../services/auditReportService');
const auditDao = require('../dao/auditDao');

router.get('/reconciliation', (req, res) => {
  try {
    const report = reconciliationService.getReconciliationReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/logs', (req, res) => {
  try {
    const { startDate, endDate, operationType, operator, limit = 100 } = req.query;
    
    const logs = auditDao.getAuditLogs({
      startDate,
      endDate,
      operationType,
      operator,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/logs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const log = auditDao.getAuditLogById(parseInt(id));
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: {
          message: '审计日志不存在',
          code: 'AUDIT_LOG_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = auditDao.getAuditStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/report/json', (req, res) => {
  try {
    const { startDate, endDate, operationType, operator } = req.query;
    
    const jsonReport = auditReportService.generateJsonReport({
      startDate,
      endDate,
      operationType,
      operator
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-report-${Date.now()}.json`);
    res.send(jsonReport);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/report/markdown', (req, res) => {
  try {
    const { startDate, endDate, operationType, operator } = req.query;
    
    const markdownReport = auditReportService.generateMarkdownReport({
      startDate,
      endDate,
      operationType,
      operator
    });
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit-report-${Date.now()}.md`);
    res.send(markdownReport);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/report/preview', (req, res) => {
  try {
    const { startDate, endDate, operationType, operator, format = 'json' } = req.query;
    
    const options = { startDate, endDate, operationType, operator };
    
    if (format === 'markdown') {
      const markdownReport = auditReportService.generateMarkdownReport(options);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(markdownReport);
    } else {
      const data = auditReportService.getAuditReportData(options);
      res.json({
        success: true,
        data
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

module.exports = router;
