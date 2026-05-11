const express = require('express');
const router = express.Router();
const chainSegmentService = require('../services/chainSegmentService');
const statusHistoryService = require('../services/statusHistoryService');
const { NotFoundError } = require('../utils/errors');

router.get('/', async (req, res, next) => {
  try {
    const { status, segment_type, batch_id } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (segment_type) filters.segment_type = segment_type;
    if (batch_id) filters.batch_id = batch_id;

    const segments = await chainSegmentService.getAllChainSegments(filters);
    res.json({ data: segments });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const segment = await chainSegmentService.getChainSegmentById(req.params.id);
    if (!segment) {
      throw new NotFoundError('冷链片段', req.params.id);
    }
    res.json({ data: segment });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const segmentData = { ...req.body };
    delete segmentData.operator;
    
    const segment = await chainSegmentService.createChainSegment(segmentData);
    res.status(201).json({ 
      data: segment,
      message: '冷链片段创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const { operator, ...completeData } = req.body;
    const segment = await chainSegmentService.completeChainSegment(
      req.params.id, 
      completeData, 
      operator
    );
    res.json({ 
      data: segment,
      message: '冷链片段已完成'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/batch/:batchId', async (req, res, next) => {
  try {
    const segments = await chainSegmentService.getChainSegmentsByBatch(req.params.batchId);
    res.json({ data: segments });
  } catch (err) {
    next(err);
  }
});

router.get('/batch/:batchId/verify', async (req, res, next) => {
  try {
    const verification = await chainSegmentService.verifyColdChain(req.params.batchId);
    res.json({ data: verification });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await statusHistoryService.getStatusHistory('chain_segment', req.params.id);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
