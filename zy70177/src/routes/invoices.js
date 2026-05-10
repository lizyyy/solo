const express = require('express');
const router = express.Router();
const invoiceService = require('../services/invoice-service');

router.get('/', async (req, res) => {
  try {
    const invoices = await invoiceService.getAllInvoices();
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: '发票不存在' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const summary = await invoiceService.getInvoicePaymentSummary(req.params.id);
    if (!summary) {
      return res.status(404).json({ success: false, error: '发票不存在' });
    }
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const invoice = await invoiceService.approveInvoice(req.params.id, req.body);
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/issue', async (req, res) => {
  try {
    const invoice = await invoiceService.issueInvoice(req.params.id, req.body);
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const invoice = await invoiceService.rejectInvoice(req.params.id, req.body);
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
