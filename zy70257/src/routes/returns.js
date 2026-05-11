const express = require('express');
const router = express.Router();
const ReturnService = require('../services/returnService');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
  const result = await ReturnService.listReturns(req.query);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取返修申请列表成功'));
});

router.post('/', async (req, res) => {
  const result = await ReturnService.submitReturn(req.body);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.status(201).json(success(result.data, '返修申请提交成功'));
});

router.get('/:id', async (req, res) => {
  const result = await ReturnService.getReturn(req.params.id);
  if (result.error) {
    return res.status(404).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取返修申请成功'));
});

router.get('/:id/details', async (req, res) => {
  const result = await ReturnService.getReturnWithDetails(req.params.id);
  if (result.error) {
    return res.status(404).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取返修申请详情成功'));
});

router.post('/:id/assign-responsibility', async (req, res) => {
  const result = await ReturnService.assignResponsibility(req.params.id, req.body);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '责任归因成功'));
});

router.post('/:id/start-rework', async (req, res) => {
  const result = await ReturnService.startRework(req.params.id);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '开始返工成功'));
});

router.post('/:id/resolve', async (req, res) => {
  const result = await ReturnService.resolveReturn(req.params.id, req.body.resolvedBy, req.body.resolutionNotes);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '返修已解决'));
});

module.exports = router;
