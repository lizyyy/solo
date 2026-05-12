const express = require('express');
const router = express.Router();
const cardService = require('../services/cardService');
const gateSyncService = require('../services/gateSyncService');
const idempotencyService = require('../services/idempotencyService');
const { store, enums } = require('../models/store');

router.post('/', (req, res) => {
  const { ownerName, phone, plateNumber, monthlyPrice, startDate, endDate, operator } = req.body;
  try {
    const card = cardService.createCard(
      ownerName, phone, plateNumber, monthlyPrice, startDate, endDate, operator
    );
    res.json({ success: true, card });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', (req, res) => {
  const { status, plateNumber } = req.query;
  const cards = cardService.listCards({ status, plateNumber });
  res.json({ success: true, count: cards.length, cards });
});

router.get('/:id', (req, res) => {
  const card = cardService.getCard(req.params.id);
  if (!card) {
    return res.status(404).json({ success: false, error: '卡不存在' });
  }
  res.json({ success: true, card });
});

router.post('/:id/renew', (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (idempotencyKey) {
    const cached = idempotencyService.check(idempotencyKey);
    if (cached) {
      return res.json({ ...cached.result, idempotent: true, cachedAt: cached.createdAt });
    }
  }

  const { months, amount, operator } = req.body;
  try {
    const result = cardService.renewCard(req.params.id, months, amount, operator);
    
    if (idempotencyKey) {
      idempotencyService.record(idempotencyKey, { success: true, ...result });
    }
    
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/pause', (req, res) => {
  const { reason, operator } = req.body;
  try {
    const card = cardService.pauseCard(req.params.id, reason, operator);
    res.json({ success: true, card });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/resume', (req, res) => {
  const { operator } = req.body;
  try {
    const card = cardService.resumeCard(req.params.id, operator);
    res.json({ success: true, card });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/bind-plate', (req, res) => {
  const { plateNumber, operator } = req.body;
  try {
    const binding = cardService.bindPlate(req.params.id, plateNumber, operator);
    res.json({ success: true, binding });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/manual-correct', (req, res) => {
  const { updates, operator, reason } = req.body;
  try {
    const card = cardService.manualCorrection(req.params.id, updates, operator, reason);
    res.json({ success: true, card });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
