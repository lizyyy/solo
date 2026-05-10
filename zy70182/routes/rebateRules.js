const express = require('express');
const router = express.Router();
const rebateRules = require('../modules/rebateRules');
const { getHistory } = require('../utils/audit');

router.get('/', (req, res) => {
  try {
    const { supplier_id } = req.query;
    const rules = rebateRules.listRules(supplier_id);
    
    res.json({
      success: true,
      data: rules
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api';
    const rule = rebateRules.createRule(req.body, operator);
    
    res.json({
      success: true,
      data: rule,
      message: '返利规则创建成功，当前状态：草稿'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const rule = rebateRules.getRule(req.params.id);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: '返利规则不存在'
      });
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/activate', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api';
    const rule = rebateRules.activateRule(req.params.id, operator);
    
    res.json({
      success: true,
      data: rule,
      message: '返利规则已激活'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/suspend', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api';
    const rule = rebateRules.suspendRule(req.params.id, operator);
    
    res.json({
      success: true,
      data: rule,
      message: '返利规则已暂停'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/archive', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api';
    const rule = rebateRules.archiveRule(req.params.id, operator);
    
    res.json({
      success: true,
      data: rule,
      message: '返利规则已归档'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getHistory('rebate_rule', req.params.id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/applicable/:supplierId/:period', (req, res) => {
  try {
    const rule = rebateRules.getApplicableRule(req.params.supplierId, req.params.period);
    
    if (!rule) {
      return res.json({
        success: true,
        data: null,
        message: '该期间没有适用的返利规则'
      });
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
