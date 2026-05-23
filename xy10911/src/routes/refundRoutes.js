const express = require('express');
const router = express.Router();
const RefundController = require('../controllers/refundController');
const { validateRequest, refundCreateSchema, refundStatusSchema, manualCorrectSchema } = require('../middleware/validation');

router.post('/', validateRequest(refundCreateSchema), RefundController.createRefund);
router.get('/', RefundController.listRefunds);
router.get('/export', RefundController.exportRefunds);
router.get('/:refundId', RefundController.getRefund);
router.put('/:refundId/status', validateRequest(refundStatusSchema), RefundController.updateRefundStatus);
router.patch('/:refundId/correct', validateRequest(manualCorrectSchema), RefundController.manualCorrect);
router.get('/:refundId/logs', RefundController.getRefundLogs);
router.post('/:refundId/exception', RefundController.recordException);

module.exports = router;
