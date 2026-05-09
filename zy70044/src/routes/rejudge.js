const express = require('express');
const router = express.Router();
const rejudgeService = require('../services/rejudge-service');
const exportService = require('../services/export-service');
const { formatDate } = require('../utils');

router.post('/submit', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { repair_order_id, new_responsibility, reason } = req.body;
    
    if (!repair_order_id || !new_responsibility || !reason) {
      return res.status(400).json({ success: false, error: '返修单ID、新责任方和复判原因不能为空' });
    }

    const result = rejudgeService.submitRejudge(repair_order_id, new_responsibility, reason, operator);
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { comment } = req.body;
    const result = rejudgeService.approveRejudge(req.params.id, comment, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { comment } = req.body;
    const result = rejudgeService.rejectRejudge(req.params.id, comment, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/', (req, res) => {
  try {
    const filter = {
      repair_order_id: req.query.repair_order_id,
      status: req.query.status,
      new_responsibility: req.query.new_responsibility,
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };
    const rejudges = rejudgeService.listRejudges(filter);
    res.json({ success: true, data: rejudges });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const filter = {
      repair_order_id: req.query.repair_order_id,
      status: req.query.status,
      new_responsibility: req.query.new_responsibility,
      limit: 1000,
      offset: 0
    };
    const rejudges = rejudgeService.listRejudges(filter);
    const csv = exportService.exportRejudgesToCSV(rejudges);
    const filename = `复判记录_${formatDate(Date.now()).replace(/[/:]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const rejudge = rejudgeService.getRejudge(req.params.id);
    if (!rejudge) {
      return res.status(404).json({ success: false, error: '复判记录不存在' });
    }
    res.json({ success: true, data: rejudge });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
