const express = require('express');
const router = express.Router();
const transactionService = require('../services/transactionService');
const utils = require('../utils');

router.post('/consume', async (req, res) => {
  try {
    const { member_id, points, period, reason } = req.body;
    if (!member_id || !points) {
      return res.status(400).json({ error: '会员ID和积分不能为空' });
    }
    const currentPeriod = period || utils.getPeriod();
    const transaction = await transactionService.addTransaction(
      member_id,
      'consumption',
      points,
      currentPeriod,
      reason || '消费入账',
      null,
      req.headers['x-operator'] || 'system'
    );
    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/refund', async (req, res) => {
  try {
    const { transaction_id, reason } = req.body;
    if (!transaction_id) {
      return res.status(400).json({ error: '原交易ID不能为空' });
    }
    const result = await transactionService.refundTransaction(
      transaction_id,
      reason,
      req.headers['x-operator'] || 'system'
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/adjust', async (req, res) => {
  try {
    const { member_id, points, reason, period } = req.body;
    if (!member_id || !points || !reason) {
      return res.status(400).json({ error: '会员ID、积分和调整原因不能为空' });
    }
    const currentPeriod = period || utils.getPeriod();
    const transaction = await transactionService.addTransaction(
      member_id,
      'manual_adjustment',
      points,
      currentPeriod,
      reason,
      null,
      req.headers['x-operator'] || 'operator'
    );
    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/member/:member_id', async (req, res) => {
  try {
    const transactions = await transactionService.getMemberTransactions(req.params.member_id);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/anomalous', async (req, res) => {
  try {
    const transactions = await transactionService.getAnomalousTransactions();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const transaction = await transactionService.getTransaction(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: '交易不存在' });
    }
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
