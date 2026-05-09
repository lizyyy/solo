const express = require('express');
const router = express.Router();
const SampleService = require('../services/sampleService');
const HistoryService = require('../services/historyService');

router.post('/', (req, res) => {
  try {
    const sample = SampleService.createSample(req.body);
    res.status(201).json(sample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const samples = SampleService.getSamples(req.query);
  res.json(samples);
});

router.get('/:id', (req, res) => {
  const sample = SampleService.getSample(req.params.id);
  if (!sample) return res.status(404).json({ error: '留样不存在' });
  res.json(sample);
});

router.get('/:id/history', (req, res) => {
  const history = SampleService.getHistory(req.params.id);
  res.json(history);
});

router.put('/:id', (req, res) => {
  try {
    const { operator, reason, ...updates } = req.body;
    const sample = SampleService.updateSample(req.params.id, updates, operator, reason);
    if (!sample) return res.status(404).json({ error: '留样不存在' });
    res.json(sample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/supplement', (req, res) => {
  try {
    const { operator, reason, ...data } = req.body;
    const sample = SampleService.supplementSample(req.params.id, data, operator, reason);
    if (!sample) return res.status(404).json({ error: '留样不存在' });
    res.json(sample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/withdraw', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const sample = SampleService.withdrawSample(req.params.id, operator, reason);
    res.json(sample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/activate', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const sample = SampleService.activateSample(req.params.id, operator, reason);
    res.json(sample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
