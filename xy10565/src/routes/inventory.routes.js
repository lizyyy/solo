const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const InventoryService = require('../services/InventoryService');
const Device = require('../models/Device');
const Product = require('../models/Product');

router.get('/check/:productId', asyncHandler(async (req, res) => {
  const inventory = InventoryService.checkInventory(req.params.productId);
  
  res.json({
    success: true,
    data: inventory
  });
}));

router.get('/devices', asyncHandler(async (req, res) => {
  const { product_id, status, is_new } = req.query;
  
  let where = '1=1';
  const params = [];
  
  if (product_id) {
    where += ' AND product_id = ?';
    params.push(product_id);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (is_new !== undefined) {
    where += ' AND is_new = ?';
    params.push(is_new === 'true' ? 1 : 0);
  }
  
  const devices = Device.findAll(where, params);
  
  const devicesWithProduct = devices.map(device => {
    const product = Product.findById(device.product_id);
    return {
      ...device,
      product_name: product?.name,
      product_sku: product?.sku
    };
  });
  
  res.json({
    success: true,
    data: devicesWithProduct
  });
}));

router.get('/summary', asyncHandler(async (req, res) => {
  const products = Product.findAll();
  
  const summary = products.map(product => {
    const available = Device.count('product_id = ? AND status = ? AND is_new = 1', [product.id, 'AVAILABLE']);
    const allocated = Device.count('product_id = ? AND status = ? AND is_new = 1', [product.id, 'ALLOCATED']);
    const shipped = Device.count('product_id = ? AND status = ? AND is_new = 1', [product.id, 'SHIPPED']);
    const used = Device.count('product_id = ? AND is_new = 0', [product.id]);
    
    return {
      product_id: product.id,
      product_sku: product.sku,
      product_name: product.name,
      available_count: available,
      allocated_count: allocated,
      shipped_count: shipped,
      used_count: used,
      total: available + allocated + shipped + used
    };
  });
  
  res.json({
    success: true,
    data: summary
  });
}));

module.exports = router;
