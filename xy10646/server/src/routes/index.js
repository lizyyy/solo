const express = require('express');
const SampleController = require('../controllers/SampleController');

const router = express.Router();

router.get('/samples', SampleController.getSampleRecords);
router.post('/samples', SampleController.createSampleRecord);
router.get('/samples/:id', SampleController.getSampleDetail);
router.put('/samples/:id', SampleController.updateSampleRecord);

router.post('/flows', SampleController.createFlowRecord);

router.get('/sampling-points', SampleController.getSamplingPoints);
router.get('/sample-bottles', SampleController.getSampleBottles);

router.get('/anomalies', SampleController.getAnomalies);

router.get('/audit-logs', SampleController.getAuditLogs);

router.get('/export', SampleController.exportReport);

module.exports = router;
