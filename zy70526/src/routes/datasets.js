const express = require('express');
const router = express.Router();
const Dataset = require('../models/Dataset');
const { validate } = require('../middleware/validation');

router.post('/', validate('dataset'), async (req, res) => {
  try {
    const dataset = await Dataset.create(req.body);
    res.status(201).json({
      message: '数据集创建成功',
      data: dataset
    });
  } catch (err) {
    res.status(500).json({
      error: '创建数据集失败',
      code: 'DATASET_CREATE_ERROR',
      message: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status
    };
    const datasets = await Dataset.findAll(filters);
    res.json({
      data: datasets
    });
  } catch (err) {
    res.status(500).json({
      error: '获取数据集列表失败',
      code: 'DATASET_LIST_ERROR',
      message: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({
        error: '数据集不存在',
        code: 'DATASET_NOT_FOUND'
      });
    }
    res.json({ data: dataset });
  } catch (err) {
    res.status(500).json({
      error: '获取数据集失败',
      code: 'DATASET_GET_ERROR',
      message: err.message
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const updated = await Dataset.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        error: '数据集不存在',
        code: 'DATASET_NOT_FOUND'
      });
    }
    const dataset = await Dataset.findById(req.params.id);
    res.json({
      message: '数据集更新成功',
      data: dataset
    });
  } catch (err) {
    res.status(500).json({
      error: '更新数据集失败',
      code: 'DATASET_UPDATE_ERROR',
      message: err.message
    });
  }
});

router.patch('/:id/status', validate('statusUpdate'), async (req, res) => {
  try {
    const updated = await Dataset.updateStatus(req.params.id, req.body.status);
    if (!updated) {
      return res.status(404).json({
        error: '数据集不存在',
        code: 'DATASET_NOT_FOUND'
      });
    }
    res.json({
      message: '数据集状态更新成功',
      status: req.body.status
    });
  } catch (err) {
    res.status(500).json({
      error: '更新数据集状态失败',
      code: 'DATASET_STATUS_ERROR',
      message: err.message
    });
  }
});

module.exports = router;