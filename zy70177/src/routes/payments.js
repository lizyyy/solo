const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment-service');

router.get('/', async (req, res) => {
  try {
    const payments = await paymentService.getAllPayments();
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payment = await paymentService.recordPayment(req.body);
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await paymentService.getPaymentAssignmentSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/unassigned-invoices', async (req, res) => {
  try {
    const invoices = await paymentService.getUnassignedInvoices();
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: '回款记录不存在' });
    }
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/details', async (req, res) => {
  try {
    const details = await paymentService.getPaymentWithAssignments(req.params.id);
    if (!details) {
      return res.status(404).json({ success: false, error: '回款记录不存在' });
    }
    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/assign', async (req, res) => {
  try {
    const { invoice_id, amount, assigned_by } = req.body;
    const assignment = await paymentService.assignPaymentToInvoice(
      req.params.id,
      invoice_id,
      amount,
      assigned_by
    );
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
