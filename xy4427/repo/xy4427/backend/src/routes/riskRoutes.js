const express = require('express');
const router = express.Router();
const {
  runDetectionHandler,
  getRiskListHandler,
  reviewRiskHandler,
  getRiskStatsHandler,
} = require('../controllers/riskController');

router.post('/detect', runDetectionHandler);
router.get('/', getRiskListHandler);
router.get('/stats', getRiskStatsHandler);
router.put('/:id/review', reviewRiskHandler);

module.exports = router;
