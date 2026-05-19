const express = require('express');
const router = express.Router();
const AppealService = require('../services/AppealService');
const AppealModel = require('../models/AppealModel');
const ExportService = require('../services/ExportService');

router.post('/', async (req, res) => {
  try {
    const result = await AppealService.submitAppeal(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      assigneeId: req.query.assigneeId,
      submitterName: req.query.submitterName,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const appeals = await AppealModel.getAppeals(filters);
    res.json({ success: true, data: appeals });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      appealStatus: req.query.status
    };
    const csv = await ExportService.exportToCSV(filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=appeals.csv');
    res.send(csv);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/report/generate', async (req, res) => {
  try {
    const report = await ExportService.generateReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await AppealService.getAppealDetail(req.params.id);
    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/assign', async (req, res) => {
  try {
    const { operatorId, operatorName, reviewerId } = req.body;
    let result;
    if (reviewerId) {
      result = await AppealService.manualAssign(req.params.id, reviewerId, operatorId, operatorName);
    } else {
      result = await AppealService.assignReviewer(req.params.id, operatorId, operatorName);
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { disposalNote, operatorId, operatorName } = req.body;
    const result = await AppealService.approveAppeal(req.params.id, disposalNote, operatorId, operatorName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { disposalNote, operatorId, operatorName } = req.body;
    const result = await AppealService.rejectAppeal(req.params.id, disposalNote, operatorId, operatorName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/escalate', async (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = await AppealService.escalateAppeal(req.params.id, operatorId, operatorName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
