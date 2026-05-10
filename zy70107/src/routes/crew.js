const express = require('express');
const router = express.Router();
const baseDataService = require('../services/baseDataService');

router.get('/', (req, res) => {
  try {
    const crew = baseDataService.listCrew();
    res.json({ success: true, data: crew });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const crew = baseDataService.getCrew(req.params.id);
    if (!crew) {
      return res.status(404).json({ success: false, error: '船员不存在' });
    }
    res.json({ success: true, data: crew });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const crew = baseDataService.createCrew(req.body);
    res.status(201).json({ success: true, data: crew });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const crew = baseDataService.updateCrew(req.params.id, req.body);
    res.json({ success: true, data: crew });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
