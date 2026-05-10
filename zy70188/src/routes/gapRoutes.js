const express = require('express');
const router = express.Router();
const gapDetectionService = require('../services/GapDetectionService');
const { success, created, handleError } = require('../utils/response');

router.post('/detect/:segmentPoolId', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await gapDetectionService.detectGaps(
      req.params.segmentPoolId,
      operator
    );
    res.json(success(result, '断号检测完成'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await gapDetectionService.listGapDetections({
      ...req.query,
      page: parseInt(req.query.page),
      pageSize: parseInt(req.query.pageSize)
    });
    res.json(success(result, '查询断号记录成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await gapDetectionService.resolveGap(
      req.params.id,
      req.body,
      operator
    );
    res.json(success(result, '处理断号成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/:id/ignore', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await gapDetectionService.ignoreGap(
      req.params.id,
      req.body.notes,
      operator
    );
    res.json(success(result, '忽略断号成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await gapDetectionService.getGapStats();
    res.json(success(stats, '获取断号统计成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;
