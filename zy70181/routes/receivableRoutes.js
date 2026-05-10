const express = require('express');
const router = express.Router();
const receivableService = require('../services/receivableService');

router.post('/customers', (req, res) => {
  try {
    const result = receivableService.createCustomer(req.body);
    res.json({ success: true, data: { customerId: result.lastInsertRowid } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/customers', (req, res) => {
  const customers = receivableService.getCustomers();
  res.json({ success: true, data: customers });
});

router.post('/contracts', (req, res) => {
  try {
    const result = receivableService.createContract(req.body);
    res.json({ success: true, data: { contractId: result.lastInsertRowid } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/contracts', (req, res) => {
  const { customerId } = req.query;
  const contracts = receivableService.getContracts(customerId ? parseInt(customerId) : null);
  res.json({ success: true, data: contracts });
});

router.post('/invoices', (req, res) => {
  try {
    const result = receivableService.createInvoice(req.body);
    res.json({ success: true, data: { invoiceId: result.lastInsertRowid } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/invoices', (req, res) => {
  const { customerId } = req.query;
  const invoices = receivableService.getInvoices(customerId ? parseInt(customerId) : null);
  
  const result = invoices.map(inv => ({
    ...inv,
    balance: receivableService.getInvoiceBalance(inv.id)
  }));
  
  res.json({ success: true, data: result });
});

router.get('/invoices/:id', (req, res) => {
  const detail = receivableService.getInvoiceDetail(parseInt(req.params.id));
  if (!detail) {
    return res.status(404).json({ success: false, error: '发票不存在' });
  }
  res.json({ success: true, data: detail });
});

router.post('/payments', (req, res) => {
  try {
    const result = receivableService.recordPayment(req.body);
    res.json({ success: true, data: { paymentId: result.lastInsertRowid } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/payments', (req, res) => {
  const { customerId } = req.query;
  const payments = receivableService.getPayments(customerId ? parseInt(customerId) : null);
  res.json({ success: true, data: payments });
});

router.get('/ledger', (req, res) => {
  const { customerId } = req.query;
  const ledger = receivableService.getReceivableLedger(customerId ? parseInt(customerId) : null);
  res.json({ success: true, data: ledger });
});

router.get('/customers/:id/summary', (req, res) => {
  const summary = receivableService.getCustomerReceivableSummary(parseInt(req.params.id));
  res.json({ success: true, data: summary });
});

module.exports = router;
