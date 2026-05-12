import express from 'express';
import db from '../database.js';
import { randomUUID } from 'crypto';
import {
  getCurrentRateInfo,
  recordUsage,
  createSubscription,
  upgradeSubscription,
  downgradeSubscription,
  addTemporaryBoost,
  getSubscriptionTimeline,
  estimateBilling,
  getExcessRecords,
  processPendingSubscriptions,
  expireSubscriptions
} from '../services/rateService.js';
import { subDays, parseISO } from 'date-fns';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/customers', (req, res) => {
  const customers = db.prepare('customers')
    .order('created_at', 'DESC')
    .all();
  res.json(customers);
});

router.get('/customers/:id', (req, res) => {
  const customer = db.prepare('customers')
    .where(c => c.id === req.params.id)
    .first();
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(customer);
});

router.post('/customers', (req, res) => {
  const { name, email, status = 'active' } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = randomUUID();
  const customer = db.insert('customers', {
    id,
    name,
    email: email || null,
    status,
    updated_at: new Date().toISOString()
  });

  res.status(201).json(customer);
});

router.get('/plans', (req, res) => {
  const plans = db.prepare('plans')
    .order('rate_limit', 'ASC')
    .all();
  res.json(plans);
});

router.get('/plans/:id', (req, res) => {
  const plan = db.prepare('plans')
    .where(p => p.id === req.params.id)
    .first();
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  res.json(plan);
});

router.post('/plans', (req, res) => {
  const {
    name,
    rateLimit,
    rateWindow = 'minute',
    priority = 1,
    description,
    isTrial = false,
    trialDays = 0,
    monthlyPrice = 0,
    status = 'active'
  } = req.body;

  if (!name || !rateLimit) {
    return res.status(400).json({ error: 'Name and rateLimit are required' });
  }

  const id = randomUUID();
  const plan = db.insert('plans', {
    id,
    name,
    rate_limit: rateLimit,
    rate_window: rateWindow,
    priority,
    description: description || null,
    is_trial: isTrial ? 1 : 0,
    trial_days: trialDays,
    monthly_price: monthlyPrice,
    status,
    updated_at: new Date().toISOString()
  });

  res.status(201).json(plan);
});

router.post('/customers/:id/rate/check', (req, res) => {
  const customerId = req.params.id;
  const { timestamp } = req.body;

  try {
    const info = getCurrentRateInfo(customerId, timestamp || Date.now());
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/customers/:id/usage/record', (req, res) => {
  const customerId = req.params.id;
  const { apiEndpoint, priority, timestamp, operator } = req.body;

  try {
    const result = recordUsage(customerId, {
      apiEndpoint,
      priority,
      timestamp,
      operator
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers/:id/timeline', (req, res) => {
  const customerId = req.params.id;
  try {
    const timeline = getSubscriptionTimeline(customerId);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers/:id/excess', (req, res) => {
  const customerId = req.params.id;
  const limit = parseInt(req.query.limit) || 50;
  try {
    const records = getExcessRecords(customerId, limit);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers/:id/billing', (req, res) => {
  const customerId = req.params.id;
  const { from, to } = req.query;

  try {
    const fromDate = from ? parseISO(from) : subDays(new Date(), 30);
    const toDate = to ? parseISO(to) : new Date();
    const estimate = estimateBilling(customerId, fromDate, toDate);
    res.json(estimate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/customers/:id/subscribe', (req, res) => {
  const customerId = req.params.id;
  const { planId, type, startDate, endDate, operator } = req.body;

  if (!planId || !type) {
    return res.status(400).json({ error: 'planId and type are required' });
  }

  try {
    const subscription = createSubscription(customerId, planId, type, {
      startDate: startDate ? parseISO(startDate) : new Date(),
      endDate: endDate ? parseISO(endDate) : null,
      operator
    });
    res.status(201).json(subscription);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/customers/:id/upgrade', (req, res) => {
  const customerId = req.params.id;
  const { planId, operator } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  try {
    const subscription = upgradeSubscription(customerId, planId, operator);
    res.json(subscription);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/customers/:id/downgrade', (req, res) => {
  const customerId = req.params.id;
  const { planId, effectiveAt, operator } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  try {
    const subscription = downgradeSubscription(
      customerId,
      planId,
      effectiveAt ? parseISO(effectiveAt) : null,
      operator
    );
    res.json(subscription);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/customers/:id/boost', (req, res) => {
  const customerId = req.params.id;
  const { boostAmount, durationHours, operator } = req.body;

  if (!boostAmount || !durationHours) {
    return res.status(400).json({ error: 'boostAmount and durationHours are required' });
  }

  try {
    const subscription = addTemporaryBoost(
      customerId,
      parseInt(boostAmount),
      parseInt(durationHours),
      operator
    );
    res.json(subscription);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/system/process-pending', (req, res) => {
  try {
    const activated = processPendingSubscriptions();
    res.json({ activated, count: activated.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/system/expire-subscriptions', (req, res) => {
  try {
    const expired = expireSubscriptions();
    res.json({ expired, count: expired.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
