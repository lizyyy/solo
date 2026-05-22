const express = require('express');
const router = express.Router();
const BatchService = require('../services/batchService');
const OrderService = require('../services/orderService');
const ReportService = require('../services/reportService');
const { requirePermission, authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', requirePermission('batch:view'), (req, res) => {
  try {
    const { page = 1, pageSize = 20, ...filters } = req.query;
    const result = BatchService.getBatches(filters, parseInt(page), parseInt(pageSize));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('batch:create'), (req, res) => {
  try {
    const batch = BatchService.createBatch(req.body, req.user);
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requirePermission('batch:view'), (req, res) => {
  try {
    const batch = BatchService.getBatchWithDetails(req.params.id);
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/import', requirePermission('batch:create'), (req, res) => {
  try {
    const result = BatchService.importOrders(
      req.params.id,
      req.body.orders,
      req.user
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:batchId/evidences', requirePermission('evidence:upload'), (req, res) => {
  try {
    const evidence = BatchService.addEvidence(
      req.params.batchId,
      req.body.order_id,
      req.body,
      req.user
    );
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/export', requirePermission('batch:export'), (req, res) => {
  try {
    const { desensitized = false, include_evidences = false } = req.body;
    const filePath = ReportService.exportBatch(req.params.id, {
      desensitized,
      includeEvidences: include_evidences
    });
    res.json({
      success: true,
      file_path: filePath,
      message: '导出成功'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('batch:edit'), (req, res) => {
  try {
    BatchService.deleteBatch(req.params.id);
    res.json({ success: true, message: '批次已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
