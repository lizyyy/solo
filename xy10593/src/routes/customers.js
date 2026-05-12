const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');
const { getStatusHistory, getManualCorrections } = require('../utils');

router.get('/', (req, res) => {
  try {
    const { channel_id } = req.query;
    const customers = customerService.listCustomers(channel_id);
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const customer = customerService.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/bookings', (req, res) => {
  try {
    const bookings = customerService.getCustomerBookings(req.params.id);
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getStatusHistory('customer', req.params.id);
    const corrections = getManualCorrections('customer', req.params.id);
    res.json({ success: true, data: { history, manual_corrections: corrections } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const customer = customerService.createCustomer(req.body);
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/correct', (req, res) => {
  try {
    const { field_name, new_value, reason, operator } = req.body;
    const customer = customerService.correctCustomer(
      req.params.id, 
      field_name, 
      new_value, 
      reason, 
      operator || 'admin'
    );
    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
