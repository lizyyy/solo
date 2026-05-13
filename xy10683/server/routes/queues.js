const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      table_type_id: req.query.table_type_id
    };
    const data = await queueService.getAllQueues(filters);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/waiting-count', async (req, res) => {
  try {
    const count = await queueService.getWaitingCount(req.query.table_type_id);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await queueService.getQueueById(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await queueService.createQueue(req.body, req.body.operator || 'system');
    res.json({ success: true, id: result.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await queueService.updateQueue(req.params.id, req.body, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/call', async (req, res) => {
  try {
    await queueService.callQueue(req.params.id, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/seat', async (req, res) => {
  try {
    await queueService.seatQueue(req.params.id, req.body.table_id, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/complete', async (req, res) => {
  try {
    await queueService.completeQueue(req.params.id, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/cancel', async (req, res) => {
  try {
    await queueService.cancelQueue(req.params.id, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/skip', async (req, res) => {
  try {
    await queueService.skipQueue(req.params.id, req.body.reason, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/restore', async (req, res) => {
  try {
    await queueService.restoreQueue(req.params.id, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
