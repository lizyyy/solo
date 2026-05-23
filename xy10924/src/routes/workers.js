const express = require('express');
const router = express.Router();
const workerService = require('../services/workerService');

router.post('/', async (req, res) => {
  try {
    const worker = await workerService.createWorker(req.body);
    res.status(201).json({ success: true, data: worker });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const workers = await workerService.getAllWorkers(req.query);
    res.json({ success: true, data: workers });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/available', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: '请提供日期参数' });
    }
    const workers = await workerService.getAvailableWorkers(date);
    res.json({ success: true, data: workers });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const worker = await workerService.getWorker(req.params.id);
    if (!worker) {
      return res.status(404).json({ success: false, error: '阿姨不存在' });
    }
    res.json({ success: true, data: worker });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const worker = await workerService.updateWorker(req.params.id, req.body);
    res.json({ success: true, data: worker });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
