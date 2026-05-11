const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/project-costs', dashboardController.getProjectCosts);
router.get('/anomalies', dashboardController.getAnomalies);
router.put('/anomalies/:id', dashboardController.handleAnomaly);
router.get('/alerts', dashboardController.getBudgetAlerts);
router.post('/alerts/:id/acknowledge', dashboardController.acknowledgeAlert);
router.get('/manual-history', dashboardController.getManualAssignmentHistory);
router.get('/export', dashboardController.exportCostReport);

module.exports = router;
