const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');

router.get('/status', statisticsController.getStatusStatistics);
router.get('/status-historical', statisticsController.getHistoricalStatusStatistics);
router.get('/manual-corrections', statisticsController.getManualCorrections);
router.get('/execution', statisticsController.getExecutionStatistics);
router.get('/department', statisticsController.getDepartmentStatistics);

module.exports = router;