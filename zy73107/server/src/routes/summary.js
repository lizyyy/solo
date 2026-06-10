const express = require('express');
const router = express.Router();
const { computeAggregation } = require('../utils/aggregation');

router.get('/', (req, res) => {
  const result = computeAggregation();
  res.json({
    code: 0,
    data: result,
    message: 'ok'
  });
});

router.get('/decisions', (req, res) => {
  const result = computeAggregation();
  res.json({
    code: 0,
    data: result.summary.decisions,
    summary: {
      total: result.summary.materialsTotal,
      releaseCount: result.summary.decisions.release.length,
      supplementCount: result.summary.decisions.supplement.length,
      holdCount: result.summary.decisions.hold.length,
      generatedAt: result.summary.generatedAt
    },
    message: 'ok'
  });
});

router.get('/anomaly-details', (req, res) => {
  const result = computeAggregation();
  res.json({
    code: 0,
    data: {
      summary: {
        anomalyCount: result.summary.anomalyCount,
        detailBreakdown: result.detailBreakdown
      },
      anomalies: result.anomalyMaterials
    },
    message: 'ok'
  });
});

module.exports = router;
