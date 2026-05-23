const express = require('express');
const router = express.Router();
const detourService = require('../services/detourService');
const validate = require('../middleware/validator');

router.post('/', validate('createDetour'), async (req, res, next) => {
  try {
    const plan = await detourService.createDetourPlan(req.body);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res) => {
  const filters = {
    status: req.query.status,
    route_id: req.query.route_id,
    plan_date: req.query.plan_date
  };
  const plans = detourService.listDetourPlans(filters);
  res.json({ success: true, data: plans });
});

router.get('/:id', (req, res, next) => {
  try {
    const plan = detourService.getDetourPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: '改线计划不存在' });
    }
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/status', validate('statusTransition'), (req, res, next) => {
  try {
    const { target_status, operator, remark } = req.body;
    const plan = detourService.transitionStatus(req.params.id, target_status, operator, remark);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/correct', validate('manualCorrect'), (req, res, next) => {
  try {
    const { operator, ...updateData } = req.body;
    const plan = detourService.manualCorrect(req.params.id, updateData, operator);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

router.post('/receipts', validate('parentReceipt'), async (req, res, next) => {
  try {
    const receipt = await detourService.addParentReceipt(req.body);
    res.json({ success: true, data: receipt });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/receipts', (req, res) => {
  const receipts = detourService.getReceiptsByPlan(req.params.id);
  res.json({ success: true, data: receipts });
});

router.get('/:id/report', (req, res, next) => {
  try {
    const report = detourService.generateReport(req.params.id);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/mark-notified', (req, res, next) => {
  try {
    const { student_ids } = req.body;
    const result = detourService.markNotified(req.params.id, student_ids || []);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
