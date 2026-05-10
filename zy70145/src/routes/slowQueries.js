const express = require('express');
const router = express.Router();
const slowQueryService = require('../services/slowQueryService');

router.post('/ingest', (req, res) => {
  try {
    const data = req.body;
    
    if (Array.isArray(data)) {
      const result = slowQueryService.ingestBatch(data);
      return res.json({
        success: true,
        data: result
      });
    }
    
    const result = slowQueryService.ingestSlowQuery(data);
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

router.post('/ingest/batch', (req, res) => {
  try {
    const { queries } = req.body;
    
    if (!Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        error: 'queries must be an array'
      });
    }
    
    const result = slowQueryService.ingestBatch(queries);
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
