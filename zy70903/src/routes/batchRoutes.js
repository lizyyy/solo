const express = require('express');
const BatchController = require('../controllers/batchController');

const router = express.Router();

router.post('/batches', BatchController.submitBatch);
router.get('/batches', BatchController.getBatchList);
router.get('/batches/statistics', BatchController.getStatistics);
router.get('/batches/:id', BatchController.getBatchDetail);
router.post('/batches/:id/trial-run', BatchController.submitTrialRun);
router.post('/batches/:id/approval', BatchController.submitApproval);
router.get('/batches/:id/export', BatchController.exportCSV);

module.exports = router;
