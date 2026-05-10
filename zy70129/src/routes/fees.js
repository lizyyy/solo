const express = require('express');
const router = express.Router();
const feeService = require('../services/feeService');
const responseHandler = require('../utils/responseHandler');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/calculate/:orderId', (req, res) => {
  try {
    const otherDeductions = req.body.other_deductions ? parseFloat(req.body.other_deductions) : 0;
    const summary = feeService.calculateFeeSummary(req.params.orderId, getOperator(req), otherDeductions);
    res.json(responseHandler.success(summary, '费用计算成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.get('/order/:orderId', (req, res) => {
  try {
    const summary = feeService.getFeeSummaryByOrderId(req.params.orderId);
    if (!summary) {
      return res.status(404).json(responseHandler.notFound('费用汇总不存在，请先计算费用'));
    }
    res.json(responseHandler.success(summary));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.post('/order/:orderId/adjust-refund', (req, res) => {
  try {
    const { new_refund_amount, reason } = req.body;
    if (!reason) {
      return res.status(400).json(responseHandler.error('人工调整必须提供原因', 400));
    }
    if (new_refund_amount === undefined || new_refund_amount < 0) {
      return res.status(400).json(responseHandler.error('新退款金额不能为空且不能为负数', 400));
    }
    
    const summary = feeService.manuallyAdjustRefund(
      req.params.orderId,
      parseFloat(new_refund_amount),
      reason,
      getOperator(req)
    );
    res.json(responseHandler.success(summary, '退款金额调整成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/order/:orderId/add-deduction', (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!reason) {
      return res.status(400).json(responseHandler.error('其他扣款必须提供原因', 400));
    }
    if (amount === undefined || amount <= 0) {
      return res.status(400).json(responseHandler.error('扣款金额必须大于0', 400));
    }
    
    const summary = feeService.addOtherDeduction(
      req.params.orderId,
      parseFloat(amount),
      reason,
      getOperator(req)
    );
    res.json(responseHandler.success(summary, '其他扣款添加成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

module.exports = router;
