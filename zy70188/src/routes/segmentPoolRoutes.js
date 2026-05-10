const express = require('express');
const router = express.Router();
const segmentPoolService = require('../services/SegmentPoolService');
const { success, created, handleError } = require('../utils/response');

router.get('/', async (req, res) => {
  try {
    const { page, pageSize, status, keyword } = req.query;
    const result = await segmentPoolService.listSegmentPools({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      status,
      keyword
    });
    res.json(success(result, '查询号段池成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await segmentPoolService.getSegmentPoolStats();
    res.json(success(stats, '获取号段池统计成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/:id', async (req, res) => {
  try {
    const segmentPool = await segmentPoolService.getSegmentPoolById(req.params.id);
    res.json(success(segmentPool, '查询号段池详情成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const segmentPool = await segmentPoolService.createSegmentPool(req.body, operator);
    res.json(created(segmentPool, '创建号段池成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const segmentPool = await segmentPoolService.updateSegmentPool(req.params.id, req.body, operator);
    res.json(success(segmentPool, '更新号段池成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;
