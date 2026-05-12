const express = require('express');
const router = express.Router();
const pickupService = require('../services/pickupService');

router.get('/daily', (req, res) => {
  try {
    const date = req.query.date;
    const report = pickupService.generatePickupReport(date);
    
    res.json({
      success: true,
      data: report,
      message: '报告生成成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/export/daily', (req, res) => {
  try {
    const date = req.query.date;
    const report = pickupService.generatePickupReport(date);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=pickup-report-${report.date}.json`);
    res.send(JSON.stringify(report, null, 2));
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
