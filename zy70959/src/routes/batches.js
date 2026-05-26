const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');

router.post('/', async (req, res) => {
  try {
    const { batch_name, created_by, records } = req.body;
    
    if (!batch_name || !created_by || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        error: '缺少必要参数: batch_name, created_by, records(非空数组)'
      });
    }

    const result = await batchService.createBatch(batch_name, created_by, records);
    
    if (result.isDuplicate) {
      return res.status(200).json({
        message: '检测到重复提交，返回已存在的批次数据',
        is_duplicate: true,
        batch: result.batch,
        records: result.records
      });
    }

    res.status(201).json({
      message: '批次创建成功',
      is_duplicate: false,
      batch: result.batch,
      records: result.records
    });
  } catch (error) {
    console.error('创建批次失败:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const batches = await batchService.getAllBatches();
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await batchService.getBatchById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, error_message } = req.body;
    const result = await batchService.updateBatchStatus(req.params.id, status, error_message);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
