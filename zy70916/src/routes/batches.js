const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');

router.post('/', (req, res) => {
  try {
    const { name, created_by } = req.body;
    if (!name || !created_by) {
      return res.status(400).json({ error: '批次名称和创建人不能为空' });
    }
    const batch = batchService.createBatch(name, created_by);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const batches = batchService.listBatches(req.query);
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const batch = batchService.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/statistics', (req, res) => {
  try {
    const stats = batchService.getBatchStatistics(req.params.id);
    if (!stats) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', (req, res) => {
  try {
    const { status, handled_by, reason } = req.body;
    if (!status || !handled_by) {
      return res.status(400).json({ error: '状态和处理人不能为空' });
    }
    const batch = batchService.updateBatchStatus(req.params.id, status, handled_by, reason);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
