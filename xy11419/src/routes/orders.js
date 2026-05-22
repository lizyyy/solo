const express = require('express');
const router = express.Router();
const OrderService = require('../services/orderService');
const BatchService = require('../services/batchService');
const ReportService = require('../services/reportService');
const { requirePermission, authMiddleware } = require('../middleware/auth');
const { ORDER_STATUS } = require('../utils/constants');

router.use(authMiddleware);

router.get('/', requirePermission('order:view'), (req, res) => {
  try {
    const { page = 1, pageSize = 20, ...filters } = req.query;
    const result = OrderService.getOrders(filters, parseInt(page), parseInt(pageSize));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('order:create'), (req, res) => {
  try {
    const order = OrderService.createOrder(req.body, req.user);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requirePermission('order:view'), (req, res) => {
  try {
    const order = OrderService.getOrderWithDetails(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requirePermission('order:edit'), (req, res) => {
  try {
    const order = OrderService.updateOrder(
      req.params.id,
      req.body,
      req.user,
      req.body.reason || '修改工单信息'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/submit', requirePermission('order:submit'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      ORDER_STATUS.SUBMITTED,
      req.user,
      req.body.reason || '提交工单'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reject', requirePermission('order:review'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      ORDER_STATUS.REJECTED,
      req.user,
      req.body.reason || '驳回工单'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/second-confirmation', requirePermission('order:review'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      ORDER_STATUS.SECOND_CONFIRMATION,
      req.user,
      req.body.reason || '需要二次确认'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/assign', requirePermission('order:assign'), (req, res) => {
  try {
    const order = OrderService.assignOrder(
      req.params.id,
      { id: req.body.assignee_id, name: req.body.assignee_name },
      req.user
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/start', requirePermission('order:update:status'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      ORDER_STATUS.IN_PROGRESS,
      req.user,
      req.body.reason || '开始维修'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/complete', requirePermission('order:review'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      ORDER_STATUS.COMPLETED,
      req.user,
      req.body.reason || '工单完成'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/audit-only', requirePermission('order:review'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      ORDER_STATUS.AUDIT_ONLY,
      req.user,
      req.body.reason || '标记为只读审计'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/cancel', requirePermission('order:edit'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      ORDER_STATUS.CANCELLED,
      req.user,
      req.body.reason || '取消工单'
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', requirePermission('order:view'), (req, res) => {
  try {
    const history = ReportService.getChangeHistory(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/audits', requirePermission('audit:view'), (req, res) => {
  try {
    const audits = OrderService.getAuditLogs(req.params.id);
    res.json(audits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/materials', requirePermission('order:edit'), (req, res) => {
  try {
    const material = BatchService.addMaterial(req.params.id, req.body);
    res.json(material);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/transition', requirePermission('order:edit'), (req, res) => {
  try {
    const order = OrderService.transitionStatus(
      req.params.id,
      req.body.to_status,
      req.user,
      req.body.reason,
      req.body.remark
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
