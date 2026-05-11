const express = require('express');
const router = express.Router();
const meterService = require('../services/meterService');
const { handleError } = require('../utils/errors');

router.post('/', (req, res) => {
  try {
    const reading = meterService.createReading(req.body);
    res.json({ success: true, data: reading });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/berthing/:berthingId', (req, res) => {
  try {
    const readings = meterService.getReadingsByBerthing(req.params.berthingId);
    res.json({ success: true, data: readings });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/berthing/:berthingId/latest', (req, res) => {
  try {
    const reading = meterService.getLatestReading(req.params.berthingId);
    res.json({ success: true, data: reading });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/berthing/:berthingId/usage', (req, res) => {
  try {
    const usage = meterService.calculateUsage(req.params.berthingId);
    res.json({ success: true, data: usage });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
