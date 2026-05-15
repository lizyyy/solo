const express = require('express');
const router = express.Router();

const deletionService = require('./services/deletionService');
const retentionService = require('./services/retentionService');
const receiptService = require('./services/receiptService');
const exportService = require('./services/exportService');

const handleAsync = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/requests', handleAsync(async (req, res) => {
  const result = await deletionService.createDeletionRequest(req.body);
  res.json(result);
}));

router.get('/requests', handleAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    customerId: req.query.customerId,
    limit: req.query.limit ? parseInt(req.query.limit) : null
  };
  const result = await deletionService.getDeletionRequests(filters);
  res.json(result);
}));

router.get('/requests/:id', handleAsync(async (req, res) => {
  const result = await deletionService.getDeletionRequestById(req.params.id);
  if (!result) {
    return res.status(404).json({ error: '删除申请不存在' });
  }
  res.json(result);
}));

router.put('/requests/:id/status', handleAsync(async (req, res) => {
  const { status, actor } = req.body;
  const result = await deletionService.updateRequestStatus(req.params.id, status, actor);
  res.json(result);
}));

router.post('/tasks/:id/execute', handleAsync(async (req, res) => {
  const { actor } = req.body;
  const result = await deletionService.executeTask(req.params.id, actor);
  res.json(result);
}));

router.post('/tasks/:id/retry', handleAsync(async (req, res) => {
  const { actor } = req.body;
  const result = await deletionService.retryFailedTask(req.params.id, actor);
  res.json(result);
}));

router.get('/failed-items', handleAsync(async (req, res) => {
  const result = await deletionService.getFailedItems(req.query.taskId);
  res.json(result);
}));

router.put('/failed-items/:id/resolve', handleAsync(async (req, res) => {
  const { actor, resolution } = req.body;
  const result = await deletionService.resolveFailedItem(req.params.id, actor, resolution);
  res.json(result);
}));

router.get('/domains', handleAsync(async (req, res) => {
  const result = await retentionService.getActiveDomains();
  res.json(result);
}));

router.post('/domains', handleAsync(async (req, res) => {
  const result = await retentionService.createDomain(req.body);
  res.json(result);
}));

router.get('/domains/:id/validate-retention', handleAsync(async (req, res) => {
  const { recordDate } = req.query;
  const result = await retentionService.validateRetentionPeriod(req.params.id, recordDate);
  res.json(result);
}));

router.get('/requests/:id/audit-logs', handleAsync(async (req, res) => {
  const result = await deletionService.getAuditLogs(req.params.id);
  res.json(result);
}));

router.post('/requests/:id/receipts', handleAsync(async (req, res) => {
  const { actor } = req.body;
  const result = await receiptService.generateReceipt(req.params.id, actor);
  res.json(result);
}));

router.get('/requests/:id/receipts', handleAsync(async (req, res) => {
  const result = await receiptService.getReceiptByRequestId(req.params.id);
  res.json(result);
}));

router.put('/receipts/:id/send', handleAsync(async (req, res) => {
  const { actor } = req.body;
  const result = await receiptService.sendReceipt(req.params.id, actor);
  res.json(result);
}));

router.put('/receipts/:id/confirm', handleAsync(async (req, res) => {
  const { actor } = req.body;
  const result = await receiptService.confirmReceipt(req.params.id, actor);
  res.json(result);
}));

router.get('/requests/:id/audit-report', handleAsync(async (req, res) => {
  const result = await receiptService.generateAuditReport(req.params.id);
  res.json(result);
}));

router.get('/export/requests', handleAsync(async (req, res) => {
  const result = await exportService.exportDeletionRequests(req.query);
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
}));

router.get('/export/tasks', handleAsync(async (req, res) => {
  const result = await exportService.exportExecutionTasks(req.query.requestId);
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
}));

router.get('/export/failed-items', handleAsync(async (req, res) => {
  const result = await exportService.exportFailedItems();
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
}));

router.get('/export/audit-logs', handleAsync(async (req, res) => {
  const result = await exportService.exportAuditLogs(req.query.requestId);
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
}));

module.exports = router;
