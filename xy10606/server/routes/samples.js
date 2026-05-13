const express = require('express');
const router = express.Router();
const sampleModel = require('../models/sample');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.sku) filter.sku = req.query.sku;
    if (req.query.name) filter.name = req.query.name;
    if (req.query.category) filter.category = req.query.category;
    
    const samples = await sampleModel.getAllSamples(filter);
    res.json(success(samples));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sample = await sampleModel.getSampleById(req.params.id);
    if (!sample) {
      return res.status(404).json(error('样品不存在'));
    }
    res.json(success(sample));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/sku/:sku', async (req, res) => {
  try {
    const sample = await sampleModel.getSampleBySku(req.params.sku);
    if (!sample) {
      return res.status(404).json(error('样品不存在'));
    }
    res.json(success(sample));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { sku, name, category, unit_cost, quantity_in_stock, created_by } = req.body;
    
    if (!sku || !name) {
      return res.status(400).json(error('SKU和样品名称不能为空'));
    }
    
    const existing = await sampleModel.getSampleBySku(sku);
    if (existing) {
      return res.status(400).json(error('SKU已存在'));
    }
    
    const sample = await sampleModel.createSample({
      sku,
      name,
      category,
      unit_cost,
      quantity_in_stock,
      created_by
    });
    
    res.json(success(sample, '样品创建成功'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { change_reason, updated_by, ...updateData } = req.body;
    const sample = await sampleModel.updateSample(req.params.id, {
      ...updateData,
      change_reason
    }, updated_by || 'system');
    
    if (!sample) {
      return res.status(404).json(error('样品不存在'));
    }
    
    res.json(success(sample, '样品更新成功'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await sampleModel.getSampleVersions(req.params.id);
    res.json(success(versions));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
