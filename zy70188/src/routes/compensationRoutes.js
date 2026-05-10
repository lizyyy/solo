const express = require('express');
const router = express.Router();
const compensationService = require('../services/CompensationService');
const { success, created, handleError } = require('../utils/response');

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await compensationService.createCompensationTask(req.body, operator);
    res.json(created(result, '创建补偿任务成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await compensationService.listCompensationTasks({
      ...req.query,
      page: parseInt(req.query.page),
      pageSize: parseInt(req.query.pageSize)
    });
    res.json(success(result, '查询补偿任务成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/:id/execute', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await compensationService.executeCompensation(req.params.id, operator);
    res.json(success(result, result.message || '执行补偿任务成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await compensationService.cancelCompensation(req.params.id, operator);
    res.json(success(result, result.message || '取消补偿任务成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await compensationService.getCompensationStats();
    res.json(success(stats, '获取补偿任务统计成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/pending', async (req, res) => {
  try {
    const tasks = await compensationService.getPendingCompensationTasks();
    res.json(success(tasks, '获取待处理补偿任务成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;
