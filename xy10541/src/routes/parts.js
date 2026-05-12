const express = require('express');
const router = express.Router();
const PartsService = require('../services/partsService');

router.get('/', (req, res) => {
  try {
    const parts = PartsService.getPartStatus();
    res.json({ success: true, data: parts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/check-availability', (req, res) => {
  try {
    const { partCodes } = req.body;
    if (!partCodes || !Array.isArray(partCodes)) {
      return res.status(400).json({
        success: false,
        error: 'partCodes 必须是数组'
      });
    }
    const result = PartsService.checkAvailability(partCodes);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
