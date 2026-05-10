const express = require('express');
const router = express.Router();
const refundService = require('../services/refundService');
const approvalService = require('../services/approvalService');
const auditService = require('../services/auditService');
const permissionService = require('../services/permissionService');
const logger = require('../logger');

router.post('/', (req, res) => {
  try {
    const result = refundService.createRefundRequest(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (result.is_idempotent) {
      return res.json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    logger.error('创建退款请求失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '创建退款请求失败',
      detail: err.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      initiator_id: req.query.initiator_id,
      product_category: req.query.product_category,
      order_id: req.query.order_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      page: parseInt(req.query.page) || 1,
      page_size: parseInt(req.query.page_size) || 50
    };

    const result = refundService.listRefundRequests(filters);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error('查询退款列表失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询退款列表失败',
      detail: err.message
    });
  }
});

router.get('/:requestId', (req, res) => {
  try {
    const request = refundService.getRefundRequestById(req.params.requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: '退款请求不存在'
      });
    }

    const approvals = approvalService.getApprovalsByRefundRequest(req.params.requestId);
    const timeline = auditService.getRefundTimeline(req.params.requestId);

    res.json({
      success: true,
      data: {
        refund_request: request,
        approvals,
        timeline
      }
    });
  } catch (err) {
    logger.error('查询退款请求失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '查询退款请求失败',
      detail: err.message
    });
  }
});

router.post('/:requestId/complete', (req, res) => {
  try {
    const { transaction_id } = req.body;
    const operatorId = req.headers['x-operator-id'] || 'admin';
    
    if (!transaction_id) {
      return res.status(400).json({
        success: false,
        error: '缺少交易ID: transaction_id'
      });
    }

    const operator = permissionService.getStaffById(operatorId);
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不存在'
      });
    }

    const result = refundService.completeRefund(req.params.requestId, transaction_id, operator);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    logger.error('完成退款失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '完成退款失败',
      detail: err.message
    });
  }
});

router.post('/:requestId/cancel', (req, res) => {
  try {
    const { reason } = req.body;
    const operatorId = req.headers['x-operator-id'] || 'admin';

    const operator = permissionService.getStaffById(operatorId);
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不存在'
      });
    }

    const result = refundService.cancelRefund(req.params.requestId, operator, reason);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    logger.error('取消退款失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '取消退款失败',
      detail: err.message
    });
  }
});

router.post('/:requestId/fix', (req, res) => {
  try {
    const { status, amount, reason } = req.body;
    const operatorId = req.headers['x-operator-id'] || 'admin';

    if (!status && amount === undefined && !reason) {
      return res.status(400).json({
        success: false,
        error: '请提供至少一个需要修改的字段: status, amount, reason'
      });
    }

    const operator = permissionService.getStaffById(operatorId);
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人不存在'
      });
    }

    const result = refundService.manualFixRefund(req.params.requestId, { status, amount, reason }, operator);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    logger.error('人工修正退款失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '人工修正退款失败',
      detail: err.message
    });
  }
});

module.exports = router;
