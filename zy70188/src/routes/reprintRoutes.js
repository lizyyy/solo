const express = require('express');
const router = express.Router();
const reprintService = require('../services/ReprintService');
const { success, created, handleError } = require('../utils/response');

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await reprintService.reprintReceipt(req.body, operator);
    res.json(created(result, '补打收据成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await reprintService.listReprintRecords({
      ...req.query,
      page: parseInt(req.query.page),
      pageSize: parseInt(req.query.pageSize)
    });
    res.json(success(result, '查询补打记录成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/receipt/:receiptNumber', async (req, res) => {
  try {
    const records = await reprintService.getReprintRecordsByReceiptNumber(
      req.params.receiptNumber
    );
    res.json(success(records, '查询收据补打记录成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await reprintService.getReprintStats(req.query);
    res.json(success(stats, '获取补打统计成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;
