const express = require('express');
const router = express.Router();
const permissionService = require('../services/permissionService');
const auditService = require('../services/auditService');
const logger = require('../logger');

router.get('/', (req, res) => {
  try {
    const categories = permissionService.getAllCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    logger.error('获取品类列表失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '获取品类列表失败',
      detail: err.message
    });
  }
});

router.get('/:categoryCode', (req, res) => {
  try {
    const rule = permissionService.getCategoryRule(req.params.categoryCode);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: '品类规则不存在'
      });
    }
    res.json({
      success: true,
      data: rule
    });
  } catch (err) {
    logger.error('获取品类规则失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '获取品类规则失败',
      detail: err.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const operator = { id: req.headers['x-operator-id'] || 'admin' };
    const id = permissionService.createCategoryRule(req.body, operator.id);
    
    auditService.log('CATEGORY_CREATE', operator, 'category_rule', id, 'success', req.body);

    res.status(201).json({
      success: true,
      message: '品类规则创建成功',
      data: { id }
    });
  } catch (err) {
    logger.error('创建品类规则失败', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.put('/:categoryCode', (req, res) => {
  try {
    const operator = { id: req.headers['x-operator-id'] || 'admin' };
    const existing = permissionService.getCategoryRule(req.params.categoryCode);
    
    permissionService.updateCategoryRule(req.params.categoryCode, req.body, operator.id);
    
    auditService.log('CATEGORY_UPDATE', operator, 'category_rule', req.params.categoryCode, 'success', null, existing, req.body);

    res.json({
      success: true,
      message: '品类规则更新成功'
    });
  } catch (err) {
    logger.error('更新品类规则失败', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
