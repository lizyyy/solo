const express = require('express');
const router = express.Router();
const { service: interruptionService } = require('../services/interruptionService');
const { handleError } = require('../utils/errors');

router.post('/', (req, res) => {
  try {
    const interruption = interruptionService.createInterruption(req.body);
    res.json({ success: true, data: interruption });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', (req, res) => {
  try {
    const interruption = interruptionService.getInterruption(req.params.id);
    res.json({ success: true, data: interruption });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/resolve', (req, res) => {
  try {
    const interruption = interruptionService.resolveInterruption(req.params.id, req.body);
    res.json({ success: true, data: interruption });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const interruption = interruptionService.cancelInterruption(req.params.id);
    res.json({ success: true, data: interruption });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/berthing/:berthingId', (req, res) => {
  try {
    const interruptions = interruptionService.getInterruptionsByBerthing(req.params.berthingId);
    res.json({ success: true, data: interruptions });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/berthing/:berthingId/active', (req, res) => {
  try {
    const interruption = interruptionService.getActiveInterruption(req.params.berthingId);
    res.json({ success: true, data: interruption });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
