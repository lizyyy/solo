const express = require('express');
const router = express.Router();
const depositService = require('../services/depositService');
const { getStatusHistory } = require('../utils');

router.get('/', (req, res) => {
  try {
    const { booking_id } = req.query;
    const ledger = depositService.getDepositLedger(booking_id);
    res.json({ success: true, data: ledger });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const deposit = depositService.getDeposit(req.params.id);
    if (!deposit) {
      return res.status(404).json({ success: false, error: '定金单不存在' });
    }
    res.json({ success: true, data: deposit });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getStatusHistory('deposit', req.params.id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const deposit = depositService.createDeposit(req.body);
    res.status(201).json({ success: true, data: deposit });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/callback', (req, res) => {
  try {
    const { callback_id, deposit_id, success, transaction_no, failure_reason, operator } = req.body;
    
    if (!callback_id || !deposit_id) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: callback_id, deposit_id' 
      });
    }
    
    const result = depositService.processPaymentCallback(
      callback_id,
      { deposit_id, success, transaction_no, failure_reason },
      operator || 'payment_gateway'
    );
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/can-sign/:booking_id', (req, res) => {
  try {
    const result = depositService.canSignContract(req.params.booking_id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
