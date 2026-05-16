const express = require('express');
const router = express.Router();
const AnonymizationRule = require('../models/AnonymizationRule');
const { validate } = require('../middleware/validation');

router.post('/', validate('anonymizationRule'), async (req, res) => {
  try {
    const rule = await AnonymizationRule.create(req.body);
    res.status(201).json({
      message: '匿名规则创建成功',
      data: rule
    });
  } catch (err) {
    res.status(500).json({
      error: '创建匿名规则失败',
      code: 'RULE_CREATE_ERROR',
      message: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const rules = await AnonymizationRule.findAllActive();
    res.json({ data: rules });
  } catch (err) {
    res.status(500).json({
      error: '获取规则列表失败',
      code: 'RULE_LIST_ERROR',
      message: err.message
    });
  }
});

router.get('/name/:name', async (req, res) => {
  try {
    const rules = await AnonymizationRule.findByName(req.params.name);
    res.json({ data: rules });
  } catch (err) {
    res.status(500).json({
      error: '获取规则版本失败',
      code: 'RULE_VERSION_ERROR',
      message: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rule = await AnonymizationRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        error: '规则不存在',
        code: 'RULE_NOT_FOUND'
      });
    }
    res.json({ data: rule });
  } catch (err) {
    res.status(500).json({
      error: '获取规则失败',
      code: 'RULE_GET_ERROR',
      message: err.message
    });
  }
});

router.patch('/:id/deactivate', async (req, res) => {
  try {
    const updated = await AnonymizationRule.deactivate(req.params.id);
    if (!updated) {
      return res.status(404).json({
        error: '规则不存在',
        code: 'RULE_NOT_FOUND'
      });
    }
    res.json({
      message: '规则已停用',
      rule_id: req.params.id
    });
  } catch (err) {
    res.status(500).json({
      error: '停用规则失败',
      code: 'RULE_DEACTIVATE_ERROR',
      message: err.message
    });
  }
});

module.exports = router;