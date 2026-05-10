const express = require('express');
const router = express.Router();
const slowQueryService = require('../services/slowQueryService');

router.get('/weekly', (req, res) => {
  try {
    let start = null;
    let end = null;
    
    if (req.query.start) {
      start = parseInt(req.query.start);
    }
    if (req.query.end) {
      end = parseInt(req.query.end);
    }
    
    const report = slowQueryService.generateWeeklyReport(start, end);
    res.json({
      success: true,
      data: report
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
