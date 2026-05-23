const express = require('express');
const router = express.Router();
const depositService = require('../services/depositService');

router.post('/', async (req, res) => {
  try {
    const deposit = await depositService.createDeposit(req.body);
    res.status(201).json({ success: true, data: deposit });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/schedule/:scheduleId', async (req, res) => {
  try {
    const deposits = await depositService.getDepositsBySchedule(req.params.scheduleId);
    res.json({ success: true, data: deposits });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/schedule/:scheduleId/summary', async (req, res) => {
  try {
    const summary = await depositService.getDepositSummary(req.params.scheduleId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const deposit = await depositService.getDeposit(req.params.id);
    if (!deposit) {
      return res.status(404).json({ success: false, error: '押金记录不存在' });
    }
    res.json({ success: true, data: deposit });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const deposit = await depositService.updateDepositStatus(req.params.id, status, req.body);
    res.json({ success: true, data: deposit });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
