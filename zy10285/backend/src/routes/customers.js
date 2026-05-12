const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');

router.get('/', (req, res) => {
  customerService.getCustomers((err, customers) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: customers });
  });
});

router.get('/:id', (req, res) => {
  customerService.getCustomerById(req.params.id, (err, customer) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!customer) return res.status(404).json({ success: false, message: '客户不存在' });
    res.json({ success: true, data: customer });
  });
});

router.post('/', (req, res) => {
  customerService.createCustomer(req.body, (err, customer) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: customer });
  });
});

router.put('/:id', (req, res) => {
  customerService.updateCustomer(req.params.id, req.body, (err, customer) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: customer });
  });
});

router.get('/:id/billing', (req, res) => {
  const { start_date, end_date } = req.query;
  customerService.getCustomerBilling(req.params.id, start_date, end_date, (err, billing) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: billing });
  });
});

module.exports = router;
