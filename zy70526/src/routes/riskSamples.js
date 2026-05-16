const express = require('express');
const router = express.Router();
const RiskSample = require('../models/RiskSample');
const { validate } = require('../middleware/validation');

router.post('/', validate('riskSample'), async (req, res) => {
  try {
    const sample = await RiskSample.create(req.body);
    res.status(201).json({
      message: '风险样本创建成功',
      data: sample
    });
  } catch (err) {
    res.status(500).json({
      error: '创建风险样本失败',
      code: 'SAMPLE_CREATE_ERROR',
      message: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      dataset_id: req.query.dataset_id,
      status: req.query.status,
      risk_level: req.query.risk_level
    };
    const samples = await RiskSample.findAll(filters);
    res.json({ data: samples });
  } catch (err) {
    res.status(500).json({
      error: '获取风险样本列表失败',
      code: 'SAMPLE_LIST_ERROR',
      message: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sample = await RiskSample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({
        error: '风险样本不存在',
        code: 'SAMPLE_NOT_FOUND'
      });
    }
    res.json({ data: sample });
  } catch (err) {
    res.status(500).json({
      error: '获取风险样本失败',
      code: 'SAMPLE_GET_ERROR',
      message: err.message
    });
  }
});

router.patch('/:id/status', validate('statusUpdate'), async (req, res) => {
  try {
    const updated = await RiskSample.updateStatus(req.params.id, req.body.status);
    if (!updated) {
      return res.status(404).json({
        error: '风险样本不存在',
        code: 'SAMPLE_NOT_FOUND'
      });
    }
    res.json({
      message: '风险样本状态更新成功',
      status: req.body.status
    });
  } catch (err) {
    res.status(400).json({
      error: '更新风险样本状态失败',
      code: 'SAMPLE_STATUS_ERROR',
      message: err.message
    });
  }
});

module.exports = router;