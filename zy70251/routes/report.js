const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const statusHistoryService = require('../services/statusHistoryService');
const { NotFoundError } = require('../utils/errors');

router.get('/', async (req, res, next) => {
  try {
    const { status, specimen_id, batch_id, report_number } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (specimen_id) filters.specimen_id = specimen_id;
    if (batch_id) filters.batch_id = batch_id;
    if (report_number) filters.report_number = report_number;

    const reports = await reportService.getAllReports(filters);
    res.json({ data: reports });
  } catch (err) {
    next(err);
  }
});

router.get('/number/:reportNumber', async (req, res, next) => {
  try {
    const report = await reportService.getReportByNumber(req.params.reportNumber);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
});

router.get('/specimen/:specimenId', async (req, res, next) => {
  try {
    const reports = await reportService.getReportsBySpecimen(req.params.specimenId);
    res.json({ data: reports });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const report = await reportService.getReportById(req.params.id);
    if (!report) {
      throw new NotFoundError('报告', req.params.id);
    }
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const reportData = { ...req.body };
    delete reportData.operator;
    
    const report = await reportService.createReport(reportData, operator);
    res.status(201).json({ 
      data: report,
      message: '报告创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/content', async (req, res, next) => {
  try {
    const { operator, ...contentData } = req.body;
    const report = await reportService.updateReportContent(
      req.params.id, 
      contentData, 
      operator
    );
    res.json({ 
      data: report,
      message: '报告内容已更新'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/review', async (req, res, next) => {
  try {
    const { operator, reason } = req.body;
    const report = await reportService.reviewReport(req.params.id, operator, reason);
    res.json({ 
      data: report,
      message: '报告已审核'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/finalize', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const report = await reportService.finalizeReport(req.params.id, operator);
    res.json({ 
      data: report,
      message: '报告已终审'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await statusHistoryService.getStatusHistory('report', req.params.id);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
