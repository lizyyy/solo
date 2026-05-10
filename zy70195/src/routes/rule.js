const express = require('express');
const router = express.Router();
const ruleService = require('../services/rule-service');

router.post('/', async (req, res) => {
  try {
    const rule = await ruleService.createExpiryRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const rules = await ruleService.getAllExpiryRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const rules = await ruleService.getActiveExpiryRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rule = await ruleService.getExpiryRuleById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, error: '到期规则不存在' });
    }
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/type/:qualificationType', async (req, res) => {
  try {
    const rule = await ruleService.getRuleByQualificationType(req.params.qualificationType);
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const rule = await ruleService.updateExpiryRule(req.params.id, req.body);
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/toggle', async (req, res) => {
  try {
    const rule = await ruleService.toggleRule(req.params.id, req.body.is_active);
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
