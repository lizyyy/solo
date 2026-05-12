const express = require('express');
const router = express.Router();
const commissionService = require('../services/commissionService');
const { getStatusHistory } = require('../utils');

router.get('/', (req, res) => {
  try {
    const { channel_id, status } = req.query;
    const report = commissionService.getCommissionReport(channel_id, status);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const commission = commissionService.getCommission(req.params.id);
    if (!commission) {
      return res.status(404).json({ success: false, error: '佣金记录不存在' });
    }
    res.json({ success: true, data: commission });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getStatusHistory('commission', req.params.id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { booking_id, operator } = req.body;
    const result = commissionService.createCommission(booking_id, operator || 'system');
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const { operator } = req.body;
    const commission = commissionService.approveCommission(req.params.id, operator || 'admin');
    res.json({ success: true, data: commission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/freeze', (req, res) => {
  try {
    const { reason, operator } = req.body;
    const commission = commissionService.freezeCommission(
      req.params.id, 
      reason, 
      operator || 'admin'
    );
    res.json({ success: true, data: commission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/unfreeze', (req, res) => {
  try {
    const { operator } = req.body;
    const commission = commissionService.unfreezeCommission(req.params.id, operator || 'admin');
    res.json({ success: true, data: commission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/void', (req, res) => {
  try {
    const { reason, operator } = req.body;
    const commission = commissionService.voidCommission(
      req.params.id, 
      reason, 
      operator || 'admin'
    );
    res.json({ success: true, data: commission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/settle', (req, res) => {
  try {
    const { settlement_no, operator } = req.body;
    const commission = commissionService.settleCommission(
      req.params.id, 
      settlement_no, 
      operator || 'finance'
    );
    res.json({ success: true, data: commission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
