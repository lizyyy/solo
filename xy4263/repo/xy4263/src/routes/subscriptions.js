const express = require('express');
const router = express.Router();

module.exports = (storage, validation) => {
  router.post('/', (req, res) => {
    const { endpoint, secret } = req.body;

    const validationResult = validation.validateSubscription(endpoint, secret);
    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const subscription = storage.createSubscription(endpoint, secret);
    res.status(201).json(subscription);
  });

  router.get('/', (req, res) => {
    const subscriptions = storage.listSubscriptions();
    res.json(subscriptions);
  });

  router.get('/:id', (req, res) => {
    const subscription = storage.getSubscription(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }

    res.json(subscription);
  });

  router.patch('/:id', (req, res) => {
    const subscription = storage.getSubscription(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }

    const { endpoint, secret, active } = req.body;
    const updates = {};

    if (endpoint !== undefined) updates.endpoint = endpoint;
    if (secret !== undefined) updates.secret = secret;
    if (active !== undefined) updates.active = active;

    const updated = storage.updateSubscription(req.params.id, updates);
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const subscription = storage.getSubscription(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }

    storage.deleteSubscription(req.params.id);
    res.status(204).send();
  });

  router.get('/:id/events', (req, res) => {
    const subscription = storage.getSubscription(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const events = storage.getEventsBySubscription(req.params.id, limit);
    res.json(events);
  });

  return router;
};