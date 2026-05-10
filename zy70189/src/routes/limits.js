const express = require('express');
const router = express.Router();
const permissionService = require('../services/permissionService');
const auditService = require('../services/auditService');
const logger = require('../logger');

router.get('/', (req, res) => {
  try {
    const limits = permissionService.getAllRefundLimits();
    res.json({
      success: true,
      data: limits
    });
  } catch (err) {
    logger.error('获取额度列表失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '获取额度列表失败',
      detail: err.message
    });
  }
});

router.get('/check', (req, res) => {
  try {
    const { staff_level, amount, category } = req.query;
    
    if (!staff_level || !amount) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: staff_level, amount'
      });
    }

    const limit = permissionService.getRefundLimit(staff_level, category);
    const amountNum = parseFloat(amount);
    
    const isWithinLimit = limit.max_amount === null || amountNum <= limit.max_amount;

    res.json({
      success: true,
      data: {
        staff_level,
        category,
        requested_amount: amountNum,
        limit_amount: limit.max_amount,
        is_within_limit: isWithinLimit
      }
    });
  } catch (err) {
    logger.error('检查额度失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '检查额度失败',
      detail: err.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { staff_level, category, max_amount } = req.body;
    const operator = { id: req.headers['x-operator-id'] || 'admin' };

    if (!staff_level || max_amount === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: staff_level, max_amount'
      });
    }

    const id = permissionService.setRefundLimit(staff_level, category, max_amount, operator.id);

    auditService.log('LIMIT_SET', operator, 'refund_limit', id, 'success', {
      staff_level,
      category,
      max_amount
    });

    res.status(201).json({
      success: true,
      message: '退款额度设置成功',
      data: { id }
    });
  } catch (err) {
    logger.error('设置额度失败', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
