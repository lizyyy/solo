const express = require('express');
const router = express.Router();

const OrderController = require('../controllers/orderController');
const RefundController = require('../controllers/refundController');
const AuditController = require('../controllers/auditController');
const ReportController = require('../controllers/reportController');
const TaskController = require('../controllers/taskController');

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Refund System API',
    version: '1.0.0'
  });
});

router.post('/orders', OrderController.validationRules.create, OrderController.create);
router.get('/orders', OrderController.validationRules.list, OrderController.list);
router.get('/orders/:id', OrderController.getById);
router.get('/orders/by-no/:orderNo', OrderController.getByOrderNo);
router.put('/orders/:id/status', OrderController.validationRules.updateStatus, OrderController.updateStatus);

router.post('/refunds', RefundController.validationRules.create, RefundController.create);
router.get('/refunds', RefundController.validationRules.list, RefundController.list);
router.get('/refunds/:id', RefundController.getById);
router.post('/refunds/:id/approve', RefundController.validationRules.approve, RefundController.approve);
router.post('/refunds/:id/reject', RefundController.validationRules.reject, RefundController.reject);
router.post('/refunds/:id/execute', RefundController.validationRules.execute, RefundController.execute);
router.post('/refunds/:id/execute-async', RefundController.validationRules.execute, RefundController.executeAsync);

router.get('/audit', AuditController.validationRules.list, AuditController.list);
router.get('/audit/:entityType/:entityId', AuditController.validationRules.getByEntity, AuditController.getByEntity);

router.get('/reports/refunds/export', ReportController.validationRules.exportRefunds, ReportController.exportRefunds);
router.get('/reports/audit/export', ReportController.validationRules.exportAudit, ReportController.exportAudit);
router.get('/reports/statistics', ReportController.validationRules.statistics, ReportController.getStatistics);

router.get('/tasks', TaskController.validationRules.list, TaskController.list);
router.post('/tasks/:id/retry', TaskController.validationRules.retry, TaskController.retry);
router.post('/tasks/retry-all-failed', TaskController.retryAllFailed);

module.exports = router;