const express = require('express');
const router = express.Router();
const checklistService = require('../services/checklistService');
const damageService = require('../services/damageService');
const responseHandler = require('../utils/responseHandler');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/', (req, res) => {
  try {
    const item = checklistService.createChecklistItem(req.body, getOperator(req));
    res.status(201).json(responseHandler.success(item, '验收项创建成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.get('/order/:orderId', (req, res) => {
  try {
    const items = checklistService.getChecklistsByOrderId(req.params.orderId);
    const summary = checklistService.getChecklistSummary(req.params.orderId);
    res.json(responseHandler.success({
      items,
      summary
    }));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.put('/:itemId', (req, res) => {
  try {
    const item = checklistService.updateChecklistItem(req.params.itemId, req.body, getOperator(req));
    res.json(responseHandler.success(item, '验收项更新成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/:itemId/check', (req, res) => {
  try {
    const item = checklistService.markAsChecked(req.params.itemId, getOperator(req));
    res.json(responseHandler.success(item, '验收完成'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.delete('/:itemId', (req, res) => {
  try {
    checklistService.deleteChecklistItem(req.params.itemId, getOperator(req));
    res.json(responseHandler.success(null, '验收项删除成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

module.exports = router;
