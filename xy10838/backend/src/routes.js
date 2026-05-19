const express = require('express');
const router = express.Router();

const deletionService = require('./services/deletionService');
const retentionService = require('./services/retentionService');
const receiptService = require('./services/receiptService');
const exportService = require('./services/exportService');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/requests', (req, res) => {
  try {
    const result = deletionService.createDeletionRequest(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      customerId: req.query.customerId,
      limit: req.query.limit ? parseInt(req.query.limit) : null
    };
    const result = deletionService.getDeletionRequests(filters);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests/:id', (req, res) => {
  try {
    const result = deletionService.getDeletionRequestById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '删除申请不存在' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/requests/:id/status', (req, res) => {
  try {
    const { status, actor } = req.body;
    const result = deletionService.updateRequestStatus(req.params.id, status, actor);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/requests/:id/mark-completed', (req, res) => {
  try {
    const { actor } = req.body;
    const result = deletionService.markRequestAsCompleted(req.params.id, actor);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/execute', (req, res) => {
  try {
    const { actor, simulateSuccess } = req.body;
    const result = deletionService.executeTask(req.params.id, actor, simulateSuccess);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/retry', (req, res) => {
  try {
    const { actor } = req.body;
    const result = deletionService.retryFailedTask(req.params.id, actor);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/failed-items', (req, res) => {
  try {
    const result = deletionService.getFailedItems(req.query.taskId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/failed-items/:id/resolve', (req, res) => {
  try {
    const { actor, resolution } = req.body;
    const result = deletionService.resolveFailedItem(req.params.id, actor, resolution);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/domains', (req, res) => {
  try {
    const result = retentionService.getActiveDomains();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/domains', (req, res) => {
  try {
    const result = retentionService.createDomain(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests/:id/audit-logs', (req, res) => {
  try {
    const result = deletionService.getAuditLogs(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/requests/:id/receipts', (req, res) => {
  try {
    const { actor } = req.body;
    const result = receiptService.generateReceipt(req.params.id, actor);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests/:id/receipts', (req, res) => {
  try {
    const result = receiptService.getReceiptByRequestId(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/receipts/:id/send', (req, res) => {
  try {
    const { actor } = req.body;
    const result = receiptService.sendReceipt(req.params.id, actor);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/receipts/:id/confirm', (req, res) => {
  try {
    const { actor } = req.body;
    const result = receiptService.confirmReceipt(req.params.id, actor);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests/:id/audit-report', (req, res) => {
  try {
    const result = receiptService.generateAuditReport(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/requests', (req, res) => {
  try {
    const result = exportService.exportDeletionRequests(req.query);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/tasks', (req, res) => {
  try {
    const result = exportService.exportExecutionTasks(req.query.requestId);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/failed-items', (req, res) => {
  try {
    const result = exportService.exportFailedItems();
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/audit-logs', (req, res) => {
  try {
    const result = exportService.exportAuditLogs(req.query.requestId);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
