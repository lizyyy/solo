const express = require('express');
const router = express.Router();
const CustomerStoreService = require('../services/CustomerStoreService');

router.post('/', async (req, res) => {
  try {
    const customer = await CustomerStoreService.createCustomer(req.body);
    res.json({
      success: true,
      status: 'completed',
      data: customer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const customers = await CustomerStoreService.getAllCustomers();
    res.json({
      success: true,
      status: 'completed',
      data: customers
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await CustomerStoreService.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: '顾客不存在'
      });
    }
    res.json({
      success: true,
      status: 'completed',
      data: customer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const customer = await CustomerStoreService.updateCustomer(req.params.id, req.body);
    res.json({
      success: true,
      status: 'completed',
      data: customer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

module.exports = router;
