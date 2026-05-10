const express = require('express');
const router = express.Router();
const recoverService = require('../services/RecoverService');
const { success, created, handleError } = require('../utils/response');

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await recoverService.recoverVoidedReceipts(req.body, operator);
    res.json(created(result, result.message || '回收作废收据成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await recoverService.listRecoveredNumbers({
      ...req.query,
      page: parseInt(req.query.page),
      pageSize: parseInt(req.query.pageSize)
    });
    res.json(success(result, '查询回收号码成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await recoverService.getRecoverStats();
    res.json(success(stats, '获取回收统计成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;
