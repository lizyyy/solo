const express = require('express');
const router = express.Router();
const dlxController = require('../controllers/dlx.controller');

router.post('/events', dlxController.createEvent);
router.get('/error-types', dlxController.listErrorTypes);
router.get('/strategies', dlxController.listStrategies);

router.post('/messages', dlxController.createDlxMessage);
router.get('/messages', dlxController.listDlxMessages);
router.get('/messages/grouped', dlxController.getGroupedByErrorType);
router.get('/messages/:id', dlxController.getDlxMessage);
router.post('/messages/:id/process', dlxController.processMessage);
router.post('/messages/:id/manual-correct', dlxController.manualCorrect);
router.post('/messages/:id/retry-after-correct', dlxController.retryAfterManualCorrect);

router.post('/batches', dlxController.createBatch);
router.get('/batches', dlxController.listBatches);
router.get('/batches/:id', dlxController.getBatch);
router.post('/batches/:id/start', dlxController.startBatch);
router.get('/batches/:id/report', dlxController.generateReport);
router.get('/batches/:id/export', dlxController.exportMessages);

module.exports = router;
