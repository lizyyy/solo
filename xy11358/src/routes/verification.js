const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');

router.post('/visitor', verificationController.verifyVisitor);
router.post('/plate', verificationController.verifyPlate);
router.post('/manual-release', verificationController.manualRelease);
router.get('/records', verificationController.getRecords);
router.get('/statistics', verificationController.getStatistics);
router.post('/batch/visitors', verificationController.batchVerifyVisitors);
router.get('/batch/:batchId', verificationController.getBatchStatus);
router.post('/batch/:batchId/retry', verificationController.retryBatch);
router.get('/report/export', verificationController.exportReport);
router.get('/report/summary', verificationController.getReportSummary);

module.exports = router;
