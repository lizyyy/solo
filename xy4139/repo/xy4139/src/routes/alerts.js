const express = require('express');
const router = express.Router();
const AlertService = require('../services/AlertService');

const alertService = new AlertService();

router.get('/', async (req, res, next) => {
  try {
    const result = await alertService.getAllAlerts(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/stock', async (req, res, next) => {
  try {
    const result = await alertService.getStockAlerts(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/expiry', async (req, res, next) => {
  try {
    const result = await alertService.getExpiryAlerts(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/statistics', async (req, res, next) => {
  try {
    const stats = await alertService.getAlertStatistics(req.user);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.post('/acknowledge', async (req, res, next) => {
  try {
    const { alert_type, entity_id } = req.body;
    const result = await alertService.acknowledgeAlert(alert_type, entity_id, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
