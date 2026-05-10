const express = require('express');
const router = express.Router();
const baseDataService = require('../services/baseDataService');

router.get('/', (req, res) => {
  try {
    const boats = baseDataService.listBoats();
    res.json({ success: true, data: boats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const boat = baseDataService.getBoat(req.params.id);
    if (!boat) {
      return res.status(404).json({ success: false, error: '渔船不存在' });
    }
    res.json({ success: true, data: boat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const boat = baseDataService.createBoat(req.body);
    res.status(201).json({ success: true, data: boat });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const boat = baseDataService.updateBoat(req.params.id, req.body);
    res.json({ success: true, data: boat });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
