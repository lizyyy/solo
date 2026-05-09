const express = require('express');
const { FineService, FineRuleService } = require('../services');

const router = express.Router({ mergeParams: true });

router.post('/rules', async (req, res) => {
  try {
    const rule = await FineRuleService.createRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/rules', async (req, res) => {
  try {
    const rules = await FineRuleService.getActiveRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/issue', async (req, res) => {
  try {
    const fine = await FineService.issueFine(
      req.params.applicationId,
      req.body.ruleCode,
      req.body.context || {},
      req.headers['x-operator'] || 'api'
    );
    res.status(201).json({ success: true, data: fine });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:fineId/pay', async (req, res) => {
  try {
    const result = await FineService.payFine(req.params.fineId, req.headers['x-operator'] || 'api');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:fineId/waive', async (req, res) => {
  try {
    const result = await FineService.waiveFine(
      req.params.fineId,
      req.body.reason,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:fineId/dispute', async (req, res) => {
  try {
    const fine = await FineService.disputeFine(
      req.params.fineId,
      req.body.reason,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: fine });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/check-overtime', async (req, res) => {
  try {
    const fine = await FineService.checkAndIssueOvertimeFine(
      req.params.applicationId,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: fine, action: fine ? 'issued' : 'no_action' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:fineId', async (req, res) => {
  try {
    const fine = await FineService.getFine(req.params.fineId);
    if (!fine) {
      return res.status(404).json({ success: false, error: '罚款记录不存在' });
    }
    res.json({ success: true, data: fine });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const fines = await FineService.listFines(req.params.applicationId);
    res.json({ success: true, data: fines });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
