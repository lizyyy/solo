const express = require('express');
const router = express.Router();
const appealController = require('../controllers/appealController');

router.post('/', appealController.createAppeal);
router.get('/query', appealController.queryAppeals);
router.get('/stats', appealController.getStats);
router.get('/export', appealController.exportAppeals);
router.get('/exceptions', appealController.getExceptions);
router.post('/check-expired', appealController.checkExpiredTempRestore);

router.get('/:id', appealController.getAppeal);
router.get('/no/:appeal_no', appealController.getAppeal);
router.put('/:id/status', appealController.updateStatus);
router.post('/:id/temp-restore', appealController.createTempRestore);
router.post('/:id/conclusion', appealController.processConclusion);
router.post('/:id/manual-correct', appealController.manualCorrect);
router.get('/:id/history', appealController.getStatusHistory);
router.get('/:id/temp-restore', appealController.getTempRestore);
router.put('/exceptions/:id/resolve', appealController.resolveException);

module.exports = router;
