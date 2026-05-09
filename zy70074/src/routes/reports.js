const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const depreciationService = require('../services/depreciationService');

router.get('/overview', (req, res) => {
  const overview = reportService.getAssetOverview();
  
  res.json({
    success: true,
    data: overview
  });
});

router.get('/transfers', (req, res) => {
  const stats = reportService.getTransferStatistics();
  
  res.json({
    success: true,
    data: stats
  });
});

router.get('/depreciation', (req, res) => {
  const depreciation = depreciationService.getDepreciationByDepartment();
  
  res.json({
    success: true,
    data: {
      byDepartment: depreciation,
      summary: {
        totalOriginalValue: depreciation.reduce((s, d) => s + d.originalValue, 0),
        totalAccumulatedDepreciation: depreciation.reduce((s, d) => s + d.accumulatedDepreciation, 0),
        totalNetBookValue: depreciation.reduce((s, d) => s + d.netBookValue, 0),
        totalMonthlyDepreciation: depreciation.reduce((s, d) => s + d.monthlyDepreciation, 0)
      }
    }
  });
});

router.get('/comprehensive', (req, res) => {
  const report = reportService.getComprehensiveReport();
  
  res.json({
    success: true,
    data: report
  });
});

module.exports = router;
