const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');
const statusHistoryService = require('../services/statusHistoryService');
const { NotFoundError } = require('../utils/errors');

router.get('/', async (req, res, next) => {
  try {
    const { status, destination_lab } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (destination_lab) filters.destination_lab = destination_lab;

    const batches = await batchService.getAllBatches(filters);
    res.json({ data: batches });
  } catch (err) {
    next(err);
  }
});

router.get('/number/:batchNumber', async (req, res, next) => {
  try {
    const batch = await batchService.getBatchByNumber(req.params.batchNumber);
    res.json({ data: batch });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const batch = await batchService.getBatchById(req.params.id);
    if (!batch) {
      throw new NotFoundError('批次', req.params.id);
    }
    res.json({ data: batch });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const batchData = { ...req.body };
    delete batchData.operator;
    
    const batch = await batchService.createBatch(batchData);
    res.status(201).json({ 
      data: batch,
      message: '批次创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/ready', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const batch = await batchService.readyBatch(req.params.id, operator);
    res.json({ 
      data: batch,
      message: '批次已准备就绪'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/ship', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const batch = await batchService.shipBatch(req.params.id, operator);
    res.json({ 
      data: batch,
      message: '批次已发货'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/start-transit', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const batch = await batchService.startTransit(req.params.id, operator);
    res.json({ 
      data: batch,
      message: '批次开始运输'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deliver', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const batch = await batchService.deliverBatch(req.params.id, operator);
    res.json({ 
      data: batch,
      message: '批次已送达'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/mark-reported', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const batch = await batchService.markBatchReported(req.params.id, operator);
    res.json({ 
      data: batch,
      message: '批次标记为已报告'
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await batchService.deleteBatch(req.params.id);
    res.json({ 
      data: result,
      message: '批次已删除'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await statusHistoryService.getStatusHistory('batch', req.params.id);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
