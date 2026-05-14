const express = require('express');
const router = express.Router();
const controller = require('../controllers/idempotencyController');

router.post('/records', controller.createRecord);
router.get('/records', controller.queryRecords);
router.get('/records/:id', controller.getRecordDetail);
router.put('/records/:id/status', controller.updateRecordStatus);
router.get('/statistics', controller.getStatistics);
router.post('/cleanup', controller.cleanupExpired);
router.get('/export', controller.exportRecords);
router.post('/import', controller.batchImport);
router.post('/simulate', controller.simulateRequest);

module.exports = router;
