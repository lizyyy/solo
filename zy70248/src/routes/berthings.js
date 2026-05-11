const express = require('express');
const router = express.Router();
const { service: berthingService } = require('../services/berthingService');
const { handleError } = require('../utils/errors');

router.post('/', (req, res) => {
  try {
    const berthing = berthingService.createBerthing(req.body);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/', (req, res) => {
  try {
    const berthings = berthingService.getAllBerthings();
    res.json({ success: true, data: berthings });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', (req, res) => {
  try {
    const berthing = berthingService.getBerthing(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/dock', (req, res) => {
  try {
    const berthing = berthingService.dock(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/connect-power', (req, res) => {
  try {
    const berthing = berthingService.connectShorePower(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/start-usage', (req, res) => {
  try {
    const berthing = berthingService.startUsingPower(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/disconnect-power', (req, res) => {
  try {
    const berthing = berthingService.disconnectPower(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/prepare-departure', (req, res) => {
  try {
    const berthing = berthingService.prepareDeparture(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/depart', (req, res) => {
  try {
    const berthing = berthingService.depart(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const berthing = berthingService.cancel(req.params.id);
    res.json({ success: true, data: berthing });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
