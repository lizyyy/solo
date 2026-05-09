const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

router.get('/full', statsController.getFullStats);

router.get('/contracts', statsController.getContractStats);

router.get('/dashboard', statsController.getDashboardStats);

router.get('/monthly-trend', statsController.getMonthlyTrend);

router.get('/initiators', statsController.getInitiatorStats);

router.get('/processing-time', statsController.getProcessingTimeStats);

module.exports = router;
