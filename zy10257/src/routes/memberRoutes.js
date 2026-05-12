const express = require('express');
const router = express.Router();
const db = require('../models/database');
const syncEngine = require('../utils/syncEngine');

router.get('/:memberId/summary', (req, res) => {
  const summary = db.getMemberSummary(req.params.memberId);
  if (!summary) {
    return res.status(404).json({ success: false, error: 'MEMBER_NOT_FOUND' });
  }
  res.json({ success: true, data: summary });
});

router.get('/:memberId/coupons', (req, res) => {
  const coupons = db.getMemberCoupons(req.params.memberId);
  res.json({ success: true, data: coupons });
});

router.get('/:memberId/stored-value', (req, res) => {
  const sv = db.getStoredValue(req.params.memberId);
  res.json({ success: true, data: sv });
});

router.get('/:memberId/points', (req, res) => {
  const pts = db.getPoints(req.params.memberId);
  res.json({ success: true, data: pts });
});

router.get('/:memberId/events', (req, res) => {
  const events = db.getEvents({ memberId: req.params.memberId });
  res.json({ success: true, data: events });
});

router.post('/coupon/redeem', async (req, res) => {
  const { couponId, storeId, orderId, idempotencyKey, expectedVersion } = req.body;
  const coupon = db.getCoupon(couponId);
  
  if (!coupon) {
    return res.status(404).json({ success: false, error: 'COUPON_NOT_FOUND' });
  }

  const result = await syncEngine.processEvent({
    id: req.body.eventId,
    eventType: 'coupon:redeem',
    storeId,
    memberId: coupon.memberId,
    entityType: 'coupon',
    entityId: couponId,
    timestamp: new Date(),
    sequence: req.body.sequence,
    payload: { orderId }
  }, { idempotencyKey, expectedVersion });

  if (!result.success) {
    return res.status(409).json(result);
  }
  res.json(result);
});

router.post('/stored-value/deduct', async (req, res) => {
  const { memberId, storeId, amount, orderId, idempotencyKey, expectedVersion } = req.body;

  const result = await syncEngine.processEvent({
    id: req.body.eventId,
    eventType: 'storedvalue:deduct',
    storeId,
    memberId,
    entityType: 'storedvalue',
    entityId: memberId,
    timestamp: new Date(),
    sequence: req.body.sequence,
    payload: { amount, orderId }
  }, { idempotencyKey, expectedVersion });

  if (!result.success) {
    return res.status(409).json(result);
  }
  res.json(result);
});

router.post('/stored-value/recharge', async (req, res) => {
  const { memberId, storeId, amount, idempotencyKey } = req.body;

  const result = await syncEngine.processEvent({
    id: req.body.eventId,
    eventType: 'storedvalue:recharge',
    storeId,
    memberId,
    entityType: 'storedvalue',
    entityId: memberId,
    timestamp: new Date(),
    sequence: req.body.sequence,
    payload: { amount }
  }, { idempotencyKey });

  if (!result.success) {
    return res.status(409).json(result);
  }
  res.json(result);
});

router.post('/points/earn', async (req, res) => {
  const { memberId, storeId, amount, orderId, idempotencyKey } = req.body;

  const result = await syncEngine.processEvent({
    id: req.body.eventId,
    eventType: 'points:earn',
    storeId,
    memberId,
    entityType: 'points',
    entityId: memberId,
    timestamp: new Date(),
    sequence: req.body.sequence,
    payload: { amount, orderId }
  }, { idempotencyKey });

  if (!result.success) {
    return res.status(409).json(result);
  }
  res.json(result);
});

router.post('/points/redeem', async (req, res) => {
  const { memberId, storeId, amount, orderId, idempotencyKey, expectedVersion } = req.body;

  const result = await syncEngine.processEvent({
    id: req.body.eventId,
    eventType: 'points:redeem',
    storeId,
    memberId,
    entityType: 'points',
    entityId: memberId,
    timestamp: new Date(),
    sequence: req.body.sequence,
    payload: { amount, orderId }
  }, { idempotencyKey, expectedVersion });

  if (!result.success) {
    return res.status(409).json(result);
  }
  res.json(result);
});

module.exports = router;
