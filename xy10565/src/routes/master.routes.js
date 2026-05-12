const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Device = require('../models/Device');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

router.post('/customers', asyncHandler(async (req, res) => {
  const customer = Customer.create({
    id: uuidv4(),
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    address: req.body.address
  });
  
  res.status(201).json({
    success: true,
    data: customer
  });
}));

router.get('/customers', asyncHandler(async (req, res) => {
  const customers = Customer.findAll();
  res.json({
    success: true,
    data: customers
  });
}));

router.post('/products', asyncHandler(async (req, res) => {
  const product = Product.create({
    id: uuidv4(),
    sku: req.body.sku,
    name: req.body.name,
    category: req.body.category,
    original_warranty_months: req.body.original_warranty_months || 12,
    description: req.body.description
  });
  
  res.status(201).json({
    success: true,
    data: product
  });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const products = Product.findAll();
  res.json({
    success: true,
    data: products
  });
}));

router.post('/devices', asyncHandler(async (req, res) => {
  const today = dayjs();
  const warrantyMonths = req.body.warranty_months || 12;
  
  const device = Device.create({
    id: uuidv4(),
    sn: req.body.sn,
    product_id: req.body.product_id,
    is_new: req.body.is_new !== false ? 1 : 0,
    status: req.body.status || 'AVAILABLE',
    warranty_start_date: req.body.warranty_start || today.format('YYYY-MM-DD'),
    warranty_end_date: req.body.warranty_end || today.add(warrantyMonths, 'month').format('YYYY-MM-DD'),
    current_owner_id: req.body.owner_id,
    notes: req.body.notes
  });
  
  res.status(201).json({
    success: true,
    data: device
  });
}));

router.get('/devices', asyncHandler(async (req, res) => {
  const devices = Device.findAll();
  res.json({
    success: true,
    data: devices
  });
}));

module.exports = router;
