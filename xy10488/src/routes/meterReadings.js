const express = require('express');
const meterService = require('../services/meterService');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await meterService.createMeterReading(req.body);
    if (result.warnings.length > 0) {
      res.status(201).json({
        ...result.reading.toJSON(),
        warnings: result.warnings
      });
    } else {
      res.status(201).json(result.reading);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/abnormal/house/:houseId', async (req, res) => {
  try {
    const readings = await meterService.getAbnormalReadings(req.params.houseId);
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
