const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');

router.post('/', (req, res, next) => {
  try {
    const result = queueService.createQueueNumber(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const { status } = req.query;
    const result = queueService.getQueueList(status);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const result = queueService.getQueueById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/call-next', (req, res, next) => {
  try {
    const result = queueService.callNextQueue();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/complete', (req, res, next) => {
  try {
    const result = queueService.completeQueue(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/overnumber', (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = queueService.markOvernumber(req.params.id, reason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/requeue', (req, res, next) => {
  try {
    const result = queueService.requeueOvernumber(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', (req, res, next) => {
  try {
    const result = queueService.cancelQueue(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/manual', (req, res, next) => {
  try {
    const result = queueService.manualUpdateQueue(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
