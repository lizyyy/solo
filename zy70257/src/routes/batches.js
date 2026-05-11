const express = require('express');
const router = express.Router();
const BatchService = require('../services/batchService');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
  const result = await BatchService.listBatches(req.query);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取批次列表成功'));
});

router.post('/', async (req, res) => {
  const result = await BatchService.createBatch(req.body);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.status(201).json(success(result.data, '批次创建成功'));
});

router.get('/:id', async (req, res) => {
  const result = await BatchService.getBatch(req.params.id);
  if (result.error) {
    return res.status(404).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取批次成功'));
});

router.get('/:id/workorders', async (req, res) => {
  const result = await BatchService.getBatchWithWorkOrders(req.params.id);
  if (result.error) {
    return res.status(404).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取批次工序成功'));
});

router.post('/:id/start', async (req, res) => {
  const result = await BatchService.startProduction(req.params.id);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '开始生产成功'));
});

router.post('/workorders/:workOrderId/complete', async (req, res) => {
  const result = await BatchService.completeWorkOrder(req.params.workOrderId, req.body.operator, req.body.notes);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, result.message || '工序完成成功'));
});

router.post('/:id/reset-rework', async (req, res) => {
  const result = await BatchService.resetForRework(req.params.id);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '重置返工成功'));
});

module.exports = router;
