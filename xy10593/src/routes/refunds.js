const express = require('express');
const router = express.Router();
const refundService = require('../services/refundService');
const { getStatusHistory } = require('../utils');

router.get('/', (req, res) => {
  try {
    const { booking_id, status } = req.query;
    const applications = refundService.listRefundApplications(booking_id, status);
    res.json({ success: true, data: applications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const application = refundService.getRefundApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: '退定申请不存在' });
    }
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getStatusHistory('refund', req.params.id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const application = refundService.createRefundApplication(req.body);
    res.status(201).json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/submit', (req, res) => {
  try {
    const { operator } = req.body;
    const application = refundService.submitRefundForApproval(req.params.id, operator || 'system');
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const { operator } = req.body;
    const application = refundService.approveRefund(req.params.id, operator || 'admin');
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { reason, operator } = req.body;
    const application = refundService.rejectRefund(
      req.params.id, 
      reason, 
      operator || 'admin'
    );
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/execute', (req, res) => {
  try {
    const { refund_method, transaction_no, operator } = req.body;
    const application = refundService.executeRefund(
      req.params.id, 
      refund_method, 
      transaction_no,
      operator || 'finance'
    );
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
