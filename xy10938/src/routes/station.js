const express = require('express');
const router = express.Router();
const stationService = require('../services/stationService');

router.post('/', (req, res, next) => {
  try {
    const result = stationService.createStation(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const result = stationService.getStationList();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const result = stationService.getStationById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const result = stationService.updateStation(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
