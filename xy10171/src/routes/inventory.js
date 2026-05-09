const express = require('express');
const inventoryService = require('../services/inventory');
const { ERROR_CODES } = require('../constants/errorCodes');

const router = express.Router();

function successResponse(data, message = 'Success') {
  return { code: 0, message, data };
}

function errorResponse(code, message) {
  return { code, message, data: null };
}

router.get('/', (req, res) => {
  const stats = inventoryService.getInventoryStats();
  res.json(successResponse(stats));
});

router.post('/seed', (req, res) => {
  const { sku, total_qty } = req.body;
  if (!sku || typeof total_qty !== 'number') {
    return res.status(400).json(errorResponse(ERROR_CODES.INVALID_REQUEST_DATA, '缺少必要参数'));
  }
  inventoryService.upsertInventory(sku, total_qty, total_qty, 0);
  const inventory = inventoryService.getInventory(sku);
  res.status(201).json(successResponse(inventory, '库存初始化成功'));
});

router.get('/:sku', (req, res) => {
  const inventory = inventoryService.getInventory(req.params.sku);
  if (!inventory) {
    return res.status(404).json(errorResponse(404, '库存不存在'));
  }
  res.json(successResponse(inventory));
});

module.exports = router;
