const express = require('express');
const router = express.Router();
const BaseDataService = require('../services/baseDataService');

router.get('/elders', async (req, res) => {
  try {
    const result = await BaseDataService.getAllElders();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/elders', async (req, res) => {
  try {
    const result = await BaseDataService.createElder(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/elders/:id', async (req, res) => {
  try {
    const result = await BaseDataService.getElderById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: '老人档案不存在' });
    } else {
      res.json({ success: true, data: result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/visitors', async (req, res) => {
  try {
    const result = await BaseDataService.getAllVisitors();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/visitors', async (req, res) => {
  try {
    const result = await BaseDataService.createVisitor(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const result = await BaseDataService.getAllRooms();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const result = await BaseDataService.createRoom(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/timeslots', async (req, res) => {
  try {
    const { date, available } = req.query;
    let result;
    if (available === 'true') {
      result = await BaseDataService.getAvailableTimeSlots(date);
    } else {
      result = await BaseDataService.getTimeSlotsByDate(date);
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/timeslots', async (req, res) => {
  try {
    const result = await BaseDataService.createTimeSlot(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
