const express = require('express');
const router = express.Router();
const { ExportService } = require('../services');

router.get('/', async (req, res) => {
  try {
    const result = await ExportService.getExportHistory(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
