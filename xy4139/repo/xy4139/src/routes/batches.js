const express = require('express');
const router = express.Router();
const BatchService = require('../services/BatchService');

const batchService = new BatchService();

router.get('/', async (req, res, next) => {
  try {
    const options = {
      chemical_id: req.query.chemical_id,
      batch_number: req.query.batch_number,
      status: req.query.status,
      is_expired: req.query.is_expired === 'true',
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };
    
    const result = await batchService.getBatches(options, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/expiring', async (req, res, next) => {
  try {
    const result = await batchService.getExpiringBatches(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/low-stock', async (req, res, next) => {
  try {
    const result = await batchService.getLowStockBatches(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/chemical/:chemicalId', async (req, res, next) => {
  try {
    const result = await batchService.getBatchesByChemicalId(req.params.chemicalId, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const batch = await batchService.getBatchById(req.params.id, req.user);
    res.json({ data: batch });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const batch = await batchService.createBatch(req.body, req.user);
    res.status(201).json({
      data: batch.toJSON(),
      message: '批次创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const batch = await batchService.updateBatch(req.params.id, req.body, req.user);
    res.json({
      data: batch.toJSON(),
      message: '批次更新成功'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
