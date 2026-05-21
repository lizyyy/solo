const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ruleService = require('../services/ruleService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/import', upload.single('rulesJSON'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '缺少规则表JSON文件' });
    }
    const result = await ruleService.importRulesFromJSON(req.file.path);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { ruleCode, ruleName, ruleType, condition, action, reason, isActive } = req.body;
    const result = await ruleService.addRule(
      ruleCode, ruleName, ruleType, condition, action, reason, isActive
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const rules = await ruleService.getAllRules(activeOnly);
    res.json({ success: true, data: rules, count: rules.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rule = await ruleService.getRuleById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, error: '规则不存在' });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await ruleService.updateRule(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await ruleService.deleteRule(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/clear/all', async (req, res) => {
  try {
    const result = await ruleService.clearAllRules();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
