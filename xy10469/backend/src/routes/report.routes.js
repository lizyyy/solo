const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');

router.get('/dashboard', reportController.getDashboardSummary);
router.get('/booth-calendar', reportController.getBoothCalendar);
router.get('/income', reportController.getIncomeReport);
router.get('/deduction-details', reportController.getDeductionDetailsReport);
router.get('/occupancy-rate', reportController.getOccupancyRateReport);
router.get('/electricity-risk', reportController.getElectricityRiskReport);
router.get('/deposit-flow', reportController.getDepositFlowReport);

module.exports = router;