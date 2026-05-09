const express = require('express');
const QuotaController = require('../controllers/QuotaController');
const StatisticsController = require('../controllers/StatisticsController');

const router = express.Router();

router.post('/apply', QuotaController.applyQuota);
router.post('/:requestId/approve', QuotaController.approve);
router.post('/:requestId/reject', QuotaController.reject);
router.post('/:requestId/cancel', QuotaController.cancel);
router.get('/:requestId/status', QuotaController.getStatus);

router.get('/stats/summary', StatisticsController.getSummary);
router.get('/stats/consistency', StatisticsController.verifyConsistency);
router.get('/stats/audit', StatisticsController.getAuditLogs);
router.get('/stats/quota/:quotaCode/operations', StatisticsController.getQuotaOperations);

module.exports = router;
