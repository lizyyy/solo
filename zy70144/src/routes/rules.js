const express = require('express');
const gateRuleService = require('../services/gateRuleService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const rules = gateRuleService.getAllRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const rule = gateRuleService.getRuleById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, error: '规则不存在' });
    }
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/config', (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ success: false, error: '缺少必要字段: config' });
    }

    const result = gateRuleService.updateRuleConfig(req.params.id, config);
    if (!result) {
      return res.status(404).json({ success: false, error: '规则不存在' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (enabled === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要字段: enabled' });
    }

    const result = gateRuleService.toggleRule(req.params.id, enabled);
    if (!result) {
      return res.status(404).json({ success: false, error: '规则不存在' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
