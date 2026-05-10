const express = require('express');
const router = express.Router();
const waterUsageService = require('../services/waterUsageService');
const { getHistoryByEntity } = require('../utils/history');
const { handleError } = require('../utils/errors');

router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    const usages = waterUsageService.getAllUsages(status);
    res.json({
      success: true,
      data: usages
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/laundry', (req, res) => {
  try {
    const { stay_id, load_count, operator } = req.body;
    const result = waterUsageService.recordLaundryUsage(
      stay_id,
      load_count,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/pool', (req, res) => {
  try {
    const { amount, reason, operator } = req.body;
    const result = waterUsageService.recordPoolRefill(
      amount,
      reason,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/other', (req, res) => {
  try {
    const { stay_id, amount, description, operator } = req.body;
    const result = waterUsageService.recordOtherUsage(
      stay_id,
      amount,
      description,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.get('/:usageId', (req, res) => {
  try {
    const usage = waterUsageService.getUsage(req.params.usageId);
    res.json({
      success: true,
      data: usage
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:usageId/revoke', (req, res) => {
  try {
    const { reason, operator } = req.body;
    const result = waterUsageService.revokeUsage(
      req.params.usageId,
      reason,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:usageId/correct', (req, res) => {
  try {
    const { new_amount, reason, operator } = req.body;
    const result = waterUsageService.correctUsage(
      req.params.usageId,
      new_amount,
      reason,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.get('/:usageId/history', (req, res) => {
  try {
    const history = getHistoryByEntity('water_usage', req.params.usageId);
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
