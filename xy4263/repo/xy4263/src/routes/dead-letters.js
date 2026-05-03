const express = require('express');
const router = express.Router();

module.exports = (storage, scheduler) => {
  router.get('/', (req, res) => {
    const { subscription_id } = req.query;
    const deadLetters = storage.getDeadLetters(subscription_id || null);
    res.json(deadLetters);
  });

  router.post('/:id/retry', (req, res) => {
    const deadLetters = storage.getDeadLetters();
    const deadLetter = deadLetters.find(dl => dl.id === req.params.id);

    if (!deadLetter) {
      return res.status(404).json({
        error: 'Dead letter not found'
      });
    }

    const event = storage.getEvent(deadLetter.event_id);
    if (!event) {
      return res.status(404).json({
        error: 'Associated event not found'
      });
    }

    storage.updateEventStatus(event.id, 'pending');
    storage.deleteDeadLetter(req.params.id);

    setImmediate(() => {
      scheduler.processEvent(event);
    });

    res.json({
      message: 'Dead letter requeued for delivery',
      event_id: event.id,
      dead_letter_id: deadLetter.id
    });
  });

  router.delete('/:id', (req, res) => {
    const deadLetters = storage.getDeadLetters();
    const deadLetter = deadLetters.find(dl => dl.id === req.params.id);

    if (!deadLetter) {
      return res.status(404).json({
        error: 'Dead letter not found'
      });
    }

    storage.deleteDeadLetter(req.params.id);
    res.status(204).send();
  });

  return router;
};