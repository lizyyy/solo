const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

router.post('/:taskId/generate', validate(schemas.generateReport), async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { reportType } = req.body;

    let result;
    if (reportType === 'SUMMARY') {
      result = await ReportService.generateSummaryReport(taskId);
    } else {
      result = await ReportService.generateDetailReport(taskId);
    }

    res.status(201).json({
      success: true,
      message: '报告生成成功',
      data: {
        reportId: result.reportId,
        reportType: reportType || 'SUMMARY',
        content: result.content
      }
    });
  } catch (error) {
    if (error.message === '任务不存在') {
      return next(new AppError(error.message, 404));
    }
    next(error);
  }
});

router.get('/:taskId/export', validate(schemas.exportReport), async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { reportType, format } = req.query;

    if (format === 'csv') {
      const result = await ReportService.exportToCSV(taskId, reportType);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send('\uFEFF' + result.csv);
    } else {
      const result = await ReportService.exportToJSON(taskId, reportType);
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.json);
    }
  } catch (error) {
    if (error.message === '任务不存在') {
      return next(new AppError(error.message, 404));
    }
    next(error);
  }
});

module.exports = router;
