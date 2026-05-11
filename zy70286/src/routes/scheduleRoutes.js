const express = require('express');
const router = express.Router();
const schedulerService = require('../services/schedulerService');
const store = require('../data/store');

router.post('/tasks', (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  const result = schedulerService.createResurfacingTask(req.body, idempotencyKey);
  
  if (result.success) {
    const statusCode = result.fromIdempotency ? 200 : 201;
    res.status(statusCode).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/tasks/:taskId/advance', (req, res) => {
  const result = schedulerService.advanceTask(req.params.taskId);
  
  if (result.success) {
    res.status(200).json(result);
  } else if (result.errorCode === 'TASK_NOT_FOUND') {
    res.status(404).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/tasks/:taskId/cancel', (req, res) => {
  const { reason } = req.body || {};
  const result = schedulerService.cancelTask(req.params.taskId, reason);
  
  if (result.success) {
    res.status(200).json(result);
  } else if (result.errorCode === 'TASK_NOT_FOUND') {
    res.status(404).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.patch('/tasks/:taskId', (req, res) => {
  const result = schedulerService.reviseTask(req.params.taskId, req.body);
  
  if (result.success) {
    res.status(200).json(result);
  } else if (result.errorCode === 'TASK_NOT_FOUND') {
    res.status(404).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/tasks/:taskId', (req, res) => {
  const result = schedulerService.getTaskDetail(req.params.taskId);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(404).json(result);
  }
});

router.get('/tasks', (req, res) => {
  const result = schedulerService.getTaskSummary(req.query);
  res.status(200).json(result);
});

router.get('/rinks/:rinkId/schedule', (req, res) => {
  const { date } = req.query;
  const result = schedulerService.getRinkSchedule(req.params.rinkId, date);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(404).json(result);
  }
});

router.post('/system/reset', (req, res) => {
  store.resetData();
  res.status(200).json({
    success: true,
    message: '数据已重置为初始状态'
  });
});

module.exports = router;
