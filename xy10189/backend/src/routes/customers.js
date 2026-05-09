const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');

router.post('/', async (req, res) => {
  const result = await customerService.createCustomer(req.body);
  res.json(result);
});

router.get('/', async (req, res) => {
  const result = await customerService.getCustomers(req.query);
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const result = await customerService.getCustomerById(req.params.id);
  res.json(result);
});

router.put('/:id', async (req, res) => {
  const result = await customerService.updateCustomer(req.params.id, req.body);
  res.json(result);
});

router.delete('/:id', async (req, res) => {
  const result = await customerService.deleteCustomer(req.params.id);
  res.json(result);
});

router.get('/:id/orders', async (req, res) => {
  const result = await customerService.getCustomerOrders(req.params.id);
  res.json(result);
});

router.get('/:id/returns', async (req, res) => {
  const result = await customerService.getCustomerReturns(req.params.id);
  res.json(result);
});

router.get('/:id/adjustments', async (req, res) => {
  const result = await customerService.getCustomerAdjustments(req.params.id);
  res.json(result);
});

module.exports = router;
