const express = require('express');
const router = express.Router();
const OrderFreezeController = require('../controllers/OrderFreezeController');
const { validate, validateQuery } = require('../middleware/validation');

router.post('/', validate('createFreeze'), OrderFreezeController.createFreeze);
router.get('/', validateQuery, OrderFreezeController.query);
router.get('/exports', OrderFreezeController.listExportFiles);
router.get('/exports/download/:filename', OrderFreezeController.downloadExport);
router.post('/exports/freeze-records', OrderFreezeController.exportFreezeRecords);
router.post('/exports/operation-logs', OrderFreezeController.exportOperationLogs);
router.post('/intercept', validate('intercept'), OrderFreezeController.checkAndIntercept);
router.get('/:id', OrderFreezeController.getById);
router.post('/:id/submit-review', validate('submitForReview'), OrderFreezeController.submitForReview);
router.post('/:id/release', validate('releaseOrCancel'), OrderFreezeController.release);
router.post('/:id/cancel', validate('releaseOrCancel'), OrderFreezeController.cancel);
router.put('/:id/manual-correct', validate('manualCorrect'), OrderFreezeController.manualCorrect);
router.get('/:id/logs', OrderFreezeController.getOperationLogs);
router.post('/:id/summary', validate('addSummary'), OrderFreezeController.addProcessingSummary);
router.post('/:id/exception', validate('recordException'), OrderFreezeController.recordException);
router.post('/:id/export-full-trace', OrderFreezeController.exportFullTrace);

module.exports = router;
