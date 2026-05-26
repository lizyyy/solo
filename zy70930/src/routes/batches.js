const express = require('express');
const router = express.Router();
const db = require('../database');
const batchService = require('../services/batchService');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { storeId, status, limit = 20, offset = 0 } = req.query;
    const batches = await batchService.getBatchList(
      req.user.role === 'admin' ? storeId : req.user.storeId,
      status,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(batches);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const detail = await batchService.getBatchDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: '批次不存在' });
    }

    if (detail.batch.store_id && req.user.role !== 'admin' && detail.batch.store_id !== req.user.storeId) {
      return res.status(403).json({ error: '无权访问此批次' });
    }

    res.json(detail);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, storeId, periodStart, periodEnd } = req.body;
    
    if (!name || !periodStart || !periodEnd) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const effectiveStoreId = req.user.role === 'admin' ? storeId : req.user.storeId;
    const result = await batchService.createBatch(
      name, effectiveStoreId, periodStart, periodEnd,
      req.user.id, req.user.realName
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/run', authenticateToken, async (req, res) => {
  try {
    const result = await batchService.runReconciliation(
      req.params.id, req.user.id, req.user.realName
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    await batchService.completeBatch(req.params.id, req.user.id, req.user.realName);
    res.json({ success: true, message: '对账批次已完成' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    await batchService.updateBatchStatus(req.params.id, status, req.user.id, req.user.realName);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/records/:recordId/review', authenticateToken, async (req, res) => {
  try {
    const { reviewResult, reviewComment } = req.body;
    
    if (!reviewResult) {
      return res.status(400).json({ error: '缺少复核结果' });
    }

    await batchService.reviewRecord(
      req.params.recordId, reviewResult, reviewComment,
      req.user.id, req.user.realName
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/discrepancies/:discrepancyId/resolve', authenticateToken, async (req, res) => {
  try {
    const { resolutionComment } = req.body;
    await batchService.resolveDiscrepancy(
      req.params.discrepancyId, resolutionComment,
      req.user.id, req.user.realName
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
