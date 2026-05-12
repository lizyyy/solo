const express = require('express');
const router = express.Router();
const { idempotencyMiddleware } = require('../utils/idempotency');
const workOrdersService = require('../services/workOrdersService');
const { getAuditLogs } = require('../utils/audit');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/', idempotencyMiddleware, (req, res) => {
  try {
    const { order_code, customer_name, customer_contact, issue_type } = req.body;
    
    if (!order_code || !customer_name) {
      return res.status(400).json({
        success: false,
        error: '工单号和客户名称不能为空'
      });
    }
    
    const order = workOrdersService.createWorkOrder({
      order_code,
      customer_name,
      customer_contact,
      issue_type
    }, getOperator(req));
    
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, customer_name } = req.query;
    const orders = workOrdersService.listWorkOrders({ status, customer_name });
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/code/:code', (req, res) => {
  try {
    const order = workOrdersService.getWorkOrderByCode(req.params.code);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: '工单不存在'
      });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const order = workOrdersService.getWorkOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: '工单不存在'
      });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const order = workOrdersService.updateWorkOrder(
      req.params.id,
      req.body,
      getOperator(req),
      req.body.reason
    );
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/close', (req, res) => {
  try {
    const order = workOrdersService.closeWorkOrder(
      req.params.id,
      getOperator(req),
      req.body?.reason
    );
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/loans', (req, res) => {
  try {
    const loans = workOrdersService.getWorkOrderLoans(req.params.id);
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit', (req, res) => {
  try {
    const logs = getAuditLogs('work_order', req.params.id);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
