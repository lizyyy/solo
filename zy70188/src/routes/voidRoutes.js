const express = require('express');
const router = express.Router();
const voidService = require('../services/VoidService');
const { success, created, handleError } = require('../utils/response');

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await voidService.voidReceipt(req.body, operator);
    res.json(created(result, '作废收据成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await voidService.listVoidRecords({
      ...req.query,
      page: parseInt(req.query.page),
      pageSize: parseInt(req.query.pageSize)
    });
    res.json(success(result, '查询作废记录成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await voidService.getVoidRecordById(req.params.id);
    res.json(success(record, '查询作废记录详情成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await voidService.getVoidStats(req.query);
    res.json(success(stats, '获取作废统计成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;
