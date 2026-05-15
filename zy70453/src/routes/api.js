const express = require('express');
const router = express.Router();

const systemController = require('../controllers/systemController');
const memberController = require('../controllers/memberController');
const labController = require('../controllers/labController');
const exportController = require('../controllers/exportController');
const operationController = require('../controllers/operationController');

router.get('/settings', systemController.getSystemSettings);
router.put('/settings', systemController.updateSystemSetting);

router.get('/members', memberController.getMembers);

router.get('/renewals', memberController.getRenewalTransactions);
router.put('/renewals/:id/result', memberController.updateTransactionProcessedResult);
router.get('/renewals/review-rollback', memberController.getRollbackReviewList);

router.get('/lab-samples', labController.getLabSamples);
router.put('/lab-samples/:id/remark', labController.updateLabSampleRemark);
router.get('/lab-samples/search', labController.searchLabSamples);

router.get('/export/exceptions', exportController.exportExceptionSamples);
router.get('/export/batch-operations', exportController.exportBatchOperationDetails);
router.get('/review/statistics', exportController.getReviewStatistics);

router.get('/candidates/batch-disable', systemController.getBatchDisableCandidates);
router.post('/operations/batch-disable', systemController.executeBatchDisable);

router.get('/candidates/rollback', operationController.getRollbackCandidates);
router.post('/operations/rollback', operationController.executeRollback);

router.get('/candidates/cleanup', operationController.getCleanupCandidates);

module.exports = router;