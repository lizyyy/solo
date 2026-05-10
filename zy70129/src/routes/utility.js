const express = require('express');
const router = express.Router();
const utilityService = require('../services/utilityService');
const responseHandler = require('../utils/responseHandler');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/', (req, res) => {
  try {
    const record = utilityService.createUtilityRecord(req.body, getOperator(req));
    res.status(201).json(responseHandler.success(record, '水电记录创建成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.get('/order/:orderId', (req, res) => {
  try {
    const records = utilityService.getUtilityRecordsByOrderId(req.params.orderId);
    const allocations = utilityService.getUtilityAllocationsByOrderId(req.params.orderId);
    const total = utilityService.getUtilityTotal(req.params.orderId);
    res.json(responseHandler.success({
      records,
      allocations,
      total
    }));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.put('/:recordId', (req, res) => {
  try {
    const record = utilityService.updateUtilityRecord(req.params.recordId, req.body, getOperator(req));
    res.json(responseHandler.success(record, '水电记录更新成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.delete('/:recordId', (req, res) => {
  try {
    utilityService.deleteUtilityRecord(req.params.recordId, getOperator(req));
    res.json(responseHandler.success(null, '水电记录删除成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/:recordId/allocate', (req, res) => {
  try {
    const { order_id, ratio, rule } = req.body;
    if (!order_id || ratio === undefined) {
      return res.status(400).json(responseHandler.error('order_id和ratio不能为空', 400));
    }
    
    const allocation = utilityService.createUtilityAllocation(
      req.params.recordId,
      order_id,
      parseFloat(ratio),
      rule,
      getOperator(req)
    );
    res.json(responseHandler.success(allocation, '水电分摊成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/allocation/:allocationId/adjust', (req, res) => {
  try {
    const { new_amount, reason } = req.body;
    if (!reason) {
      return res.status(400).json(responseHandler.error('人工调整必须提供原因', 400));
    }
    if (new_amount === undefined || new_amount < 0) {
      return res.status(400).json(responseHandler.error('新金额不能为空且不能为负数', 400));
    }
    
    const allocation = utilityService.manuallyAdjustUtilityAllocation(
      req.params.allocationId,
      parseFloat(new_amount),
      reason,
      getOperator(req)
    );
    res.json(responseHandler.success(allocation, '人工调整成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

module.exports = router;
