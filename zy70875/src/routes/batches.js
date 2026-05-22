const express = require('express');
const router = express.Router();
const { createBatch, getBatches, getBatchById } = require('../services/batchService');
const { processBatch, getTasksByBatchId } = require('../services/taskService');

router.post('/', async (req, res) => {
  try {
    const { batchName, operator, period, rawData } = req.body;
    
    if (!batchName || !operator || !period || !rawData) {
      return res.status(400).json({
        error: '缺少必填字段: batchName, operator, period, rawData'
      });
    }
    
    const batch = await createBatch({ batchName, operator, period, rawData });
    
    res.status(201).json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const batches = await getBatches(limit, offset);
    
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        error: '批次不存在'
      });
    }
    
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.post('/:id/process', async (req, res) => {
  try {
    const batchId = req.params.id;
    const batch = await getBatchById(batchId);
    
    if (!batch) {
      return res.status(404).json({
        error: '批次不存在'
      });
    }
    
    const task = await processBatch(batchId);
    
    res.json({
      success: true,
      data: {
        task,
        message: '核算任务已启动，请通过任务接口查询状态'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/:id/tasks', async (req, res) => {
  try {
    const tasks = await getTasksByBatchId(req.params.id);
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
