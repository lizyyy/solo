const express = require('express');
const router = express.Router();
const sampleEvents = require('../sample-events');

module.exports = (storage, validation, scheduler) => {
  router.post('/', (req, res) => {
    const { subscription_id, event_type, payload, idempotency_key } = req.body;

    const validationResult = validation.validateEvent(event_type, payload);
    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const subscription = storage.getSubscription(subscription_id);
    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }

    const idempotencyResult = validation.checkIdempotency(idempotency_key, subscription_id);
    if (idempotencyResult.isDuplicate) {
      return res.status(200).json({
        duplicate: true,
        existing_event: idempotencyResult.existingEvent
      });
    }

    const event = storage.createEvent(subscription_id, event_type, payload, idempotency_key);

    if (idempotency_key) {
      validation.recordIdempotency(idempotency_key, event.id, subscription_id);
    }

    setImmediate(() => {
      scheduler.processEvent(event);
    });

    res.status(201).json(event);
  });

  router.get('/samples', (req, res) => {
    const { category, type } = req.query;
    
    if (category && type) {
      const event = sampleEvents.get(category, type);
      if (!event) {
        return res.status(404).json({
          error: 'Sample event not found',
          available_categories: ['payment', 'order', 'subscription', 'user']
        });
      }
      return res.json(event);
    }

    const events = sampleEvents.list();
    res.json(events);
  });

  router.get('/:id', (req, res) => {
    const event = storage.getEvent(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    res.json(event);
  });

  router.get('/:id/logs', (req, res) => {
    const event = storage.getEvent(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    const logs = storage.getDeliveryLogs(req.params.id);
    res.json(logs);
  });

  router.post('/:id/retry', (req, res) => {
    const event = storage.getEvent(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    storage.updateEventStatus(req.params.id, 'pending');

    setImmediate(() => {
      scheduler.processEvent(event);
    });

    res.json({
      message: 'Retry scheduled',
      event_id: event.id
    });
  });

  return router;
};