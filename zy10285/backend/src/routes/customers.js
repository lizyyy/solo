const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');

router.get('/', (req, res) => {
  try {
    const customers = customerService.getCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const customer = customerService.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const customer = customerService.createCustomer(req.body);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const customer = customerService.updateCustomer(req.params.id, req.body);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/billing', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const billing = customerService.getCustomerBilling(req.params.id, start_date, end_date);
    res.json({ success: true, data: billing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
