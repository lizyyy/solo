const express = require('express');
const router = express.Router();

const sealRuleService = require('../services/sealRuleService');

router.post('/', async (req, res) => {
  try {
    const result = await sealRuleService.createSealRule(req.body);
    res.json({ success: true, data: { id: result.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const rules = await sealRuleService.getAllSealRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:sealType', async (req, res) => {
  try {
    const rule = await sealRuleService.getSealRuleByType(req.params.sealType);
    if (!rule) {
      return res.status(404).json({ success: false, error: '印章规则不存在' });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:sealType', async (req, res) => {
  try {
    const result = await sealRuleService.updateSealRule(req.params.sealType, req.body);
    res.json({ success: true, data: { changes: result.changes } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/check-authorization', async (req, res) => {
  try {
    const { seal_type, authorizer, amount } = req.body;
    const result = await sealRuleService.checkSealAuthorization(seal_type, authorizer, amount);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
