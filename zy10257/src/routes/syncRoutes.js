const express = require('express');
const router = express.Router();
const db = require('../models/database');
const syncEngine = require('../utils/syncEngine');

router.post('/event', async (req, res) => {
  const result = await syncEngine.processEvent(req.body.event, {
    idempotencyKey: req.body.idempotencyKey,
    expectedVersion: req.body.expectedVersion
  });

  if (!result.success && !result.conflicted) {
    return res.status(409).json(result);
  }
  res.json(result);
});

router.post('/batch', async (req, res) => {
  const { storeId, events, batchId } = req.body;

  const batch = db.createOfflineBatch({
    id: batchId,
    storeId,
    events
  });

  const result = await syncEngine.processOfflineBatch(batch.id);
  res.json(result);
});

router.post('/batch/:batchId/sync', async (req, res) => {
  const result = await syncEngine.processOfflineBatch(req.params.batchId);
  res.json(result);
});

router.get('/batch/:batchId', (req, res) => {
  const batch = db.getOfflineBatch(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ success: false, error: 'BATCH_NOT_FOUND' });
  }
  res.json({ success: true, data: batch });
});

router.get('/batches', (req, res) => {
  const batches = db.getAllBatches();
  res.json({ success: true, data: batches });
});

router.post('/conflicts/:eventId/resolve', async (req, res) => {
  const { resolution, note } = req.body;
  const result = await syncEngine.resolveConflict(req.params.eventId, resolution, note);
  res.json(result);
});

router.get('/conflicts', (req, res) => {
  const conflicts = db.getEvents({ status: 'conflicted' });
  res.json({ success: true, data: conflicts });
});

router.get('/status', (req, res) => {
  const status = db.getSyncStatus();
  res.json({ success: true, data: status });
});

router.get('/events', (req, res) => {
  const filters = {};
  if (req.query.storeId) filters.storeId = req.query.storeId;
  if (req.query.memberId) filters.memberId = req.query.memberId;
  if (req.query.status) filters.status = req.query.status;
  
  const events = db.getEvents(filters);
  res.json({ success: true, data: events });
});

module.exports = router;
