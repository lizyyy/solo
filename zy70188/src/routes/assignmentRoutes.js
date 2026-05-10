const express = require('express');
const router = express.Router();
const receiptAssignmentService = require('../services/ReceiptAssignmentService');
const { success, created, handleError } = require('../utils/response');

router.post('/assign', async (req, res) => {
  try {
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await receiptAssignmentService.assignReceipt(req.body, operator);
    res.json(created(result, '分配收据号成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/batch-assign', async (req, res) => {
  try {
    const { count, ...data } = req.body;
    const operator = {
      id: req.headers['x-operator-id'],
      name: req.headers['x-operator-name']
    };
    const result = await receiptAssignmentService.batchAssign(count, data, operator);
    res.json(created(result, `批量分配${count}个收据号成功`));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await receiptAssignmentService.listAssignments({
      ...req.query,
      page: parseInt(req.query.page),
      pageSize: parseInt(req.query.pageSize)
    });
    res.json(success(result, '查询分配记录成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/receipt/:receiptNumber', async (req, res) => {
  try {
    const assignment = await receiptAssignmentService.getAssignmentByReceiptNumber(
      req.params.receiptNumber
    );
    res.json(success(assignment, '查询收据记录成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/:id', async (req, res) => {
  try {
    const assignment = await receiptAssignmentService.getAssignmentDetail(req.params.id);
    res.json(success(assignment, '查询分配详情成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/stats/window/:windowId', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const stats = await receiptAssignmentService.getWindowAssignmentStats(
      req.params.windowId,
      start_date,
      end_date
    );
    res.json(success(stats, '获取窗口统计成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;
