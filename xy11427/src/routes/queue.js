const express = require('express');
const router = express.Router();
const {
  getNextBatch,
  processRetry,
  markCompleted,
  markFailed,
  assignToManual,
  getQueueStats
} = require('../services/compensationQueue');

router.get('/stats', async (req, res) => {
  try {
    const stats = getQueueStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/next', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const items = getNextBatch(limit);
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:queueId/retry', async (req, res) => {
  try {
    const result = processRetry(req.params.queueId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:queueId/complete', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = markCompleted(req.params.queueId, operator || 'system');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:queueId/fail', async (req, res) => {
  try {
    const { error_message, error_code } = req.body;
    const result = markFailed(req.params.queueId, error_message, error_code);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:queueId/manual', async (req, res) => {
  try {
    const { assigned_to, notes } = req.body;
    const result = assignToManual(req.params.queueId, assigned_to, notes);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
