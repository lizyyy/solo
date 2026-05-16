const express = require('express');
const router = express.Router();
const ArbitrationOpinion = require('../models/ArbitrationOpinion');
const ArbitrationSummary = require('../models/ArbitrationSummary');
const { validate } = require('../middleware/validation');

router.post('/opinions', validate('arbitrationOpinion'), async (req, res) => {
  try {
    const opinion = await ArbitrationOpinion.create(req.body);
    res.status(201).json({
      message: '仲裁意见创建成功',
      data: opinion
    });
  } catch (err) {
    res.status(400).json({
      error: '创建仲裁意见失败',
      code: 'OPINION_CREATE_ERROR',
      message: err.message
    });
  }
});

router.get('/opinions/sample/:sampleId', async (req, res) => {
  try {
    const opinions = await ArbitrationOpinion.findByRiskSampleId(req.params.sampleId);
    res.json({ data: opinions });
  } catch (err) {
    res.status(500).json({
      error: '获取仲裁意见失败',
      code: 'OPINION_LIST_ERROR',
      message: err.message
    });
  }
});

router.get('/opinions/:id', async (req, res) => {
  try {
    const opinion = await ArbitrationOpinion.findById(req.params.id);
    if (!opinion) {
      return res.status(404).json({
        error: '仲裁意见不存在',
        code: 'OPINION_NOT_FOUND'
      });
    }
    res.json({ data: opinion });
  } catch (err) {
    res.status(500).json({
      error: '获取仲裁意见失败',
      code: 'OPINION_GET_ERROR',
      message: err.message
    });
  }
});

router.post('/summaries/generate/:datasetId', async (req, res) => {
  try {
    const summary = await ArbitrationSummary.generate(req.params.datasetId);
    res.json({
      message: '仲裁摘要生成成功',
      data: summary
    });
  } catch (err) {
    res.status(500).json({
      error: '生成仲裁摘要失败',
      code: 'SUMMARY_GENERATE_ERROR',
      message: err.message
    });
  }
});

router.get('/summaries', async (req, res) => {
  try {
    const summaries = await ArbitrationSummary.findAll();
    res.json({ data: summaries });
  } catch (err) {
    res.status(500).json({
      error: '获取仲裁摘要列表失败',
      code: 'SUMMARY_LIST_ERROR',
      message: err.message
    });
  }
});

router.get('/summaries/:id', async (req, res) => {
  try {
    const summary = await ArbitrationSummary.findById(req.params.id);
    if (!summary) {
      return res.status(404).json({
        error: '仲裁摘要不存在',
        code: 'SUMMARY_NOT_FOUND'
      });
    }
    res.json({ data: summary });
  } catch (err) {
    res.status(500).json({
      error: '获取仲裁摘要失败',
      code: 'SUMMARY_GET_ERROR',
      message: err.message
    });
  }
});

router.get('/summaries/dataset/:datasetId', async (req, res) => {
  try {
    const summaries = await ArbitrationSummary.findByDatasetId(req.params.datasetId);
    res.json({ data: summaries });
  } catch (err) {
    res.status(500).json({
      error: '获取仲裁摘要失败',
      code: 'SUMMARY_GET_ERROR',
      message: err.message
    });
  }
});

router.patch('/summaries/:id/export', async (req, res) => {
  try {
    const updated = await ArbitrationSummary.markExported(req.params.id);
    if (!updated) {
      return res.status(404).json({
        error: '仲裁摘要不存在',
        code: 'SUMMARY_NOT_FOUND'
      });
    }
    res.json({
      message: '仲裁摘要已标记为已导出'
    });
  } catch (err) {
    res.status(500).json({
      error: '标记导出状态失败',
      code: 'SUMMARY_EXPORT_ERROR',
      message: err.message
    });
  }
});

module.exports = router;