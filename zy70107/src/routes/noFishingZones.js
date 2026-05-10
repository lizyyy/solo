const express = require('express');
const router = express.Router();
const baseDataService = require('../services/baseDataService');

router.get('/', (req, res) => {
  try {
    const zones = baseDataService.listNoFishingZones();
    res.json({ success: true, data: zones });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const zone = baseDataService.getNoFishingZone(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, error: '禁渔区不存在' });
    }
    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const zone = baseDataService.createNoFishingZone(req.body);
    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const zone = baseDataService.updateNoFishingZone(req.params.id, req.body);
    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
