const express = require('express');
const router = express.Router();
const OrderService = require('../services/orderService');
const ReportService = require('../services/reportService');

router.post('/', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const operator = req.headers['x-operator'] || 'system';
    
    const result = OrderService.createOrder(req.body, idempotencyKey, operator);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.customerId) filters.customerId = req.query.customerId;
    if (req.query.technicianId) filters.technicianId = req.query.technicianId;

    const orders = OrderService.listOrders(filters);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const order = OrderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/assign-technician', (req, res) => {
  try {
    const { technicianId, startTime, endTime } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!technicianId || !startTime) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: technicianId, startTime'
      });
    }

    const result = OrderService.assignTechnician(
      req.params.id,
      technicianId,
      startTime,
      endTime,
      operator
    );

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/allocate-parts', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = OrderService.allocateParts(req.params.id, operator);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/send-confirmation', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = OrderService.sendConfirmation(req.params.id, operator);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/confirm', (req, res) => {
  try {
    const { confirmationId } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!confirmationId) {
      return res.status(400).json({ success: false, error: '缺少 confirmationId' });
    }

    const result = OrderService.confirmAppointment(req.params.id, confirmationId, operator);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/reschedule', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = OrderService.requestReschedule(req.params.id, req.body, operator);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/reschedule/:rescheduleId/approve', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = OrderService.approveReschedule(
      req.params.id,
      req.params.rescheduleId,
      operator
    );
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/start', (req, res) => {
  try {
    const { actualStartTime } = req.body;
    const operator = req.headers['x-operator'] || 'system';
    const result = OrderService.startOrder(req.params.id, actualStartTime, operator);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const { actualEndTime } = req.body;
    const operator = req.headers['x-operator'] || 'system';
    const result = OrderService.completeOrder(req.params.id, actualEndTime, operator);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const { reason } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!reason) {
      return res.status(400).json({ success: false, error: '缺少取消原因 reason' });
    }

    const result = OrderService.cancelOrder(req.params.id, reason, operator);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/manual-correction', (req, res) => {
  try {
    const { updates, reason } = req.body;
    const operator = req.headers['x-operator'];

    if (!operator) {
      return res.status(400).json({ success: false, error: '人工修正必须指定操作者 (X-Operator' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, error: '缺少修正原因 reason' });
    }

    const result = OrderService.manualCorrection(req.params.id, updates, operator, reason);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/report', (req, res) => {
  try {
    const report = ReportService.generateOrderReport(req.params.id);
    const format = req.query.format || 'json';

    if (format === 'text') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(ReportService.exportToText(report));
    } else {
      res.json(report);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
