const express = require('express');
const router = express.Router();
const { getRefundRecords, createRefund, reviewRefund } = require('../controllers/refundController');
const { checkCardStatus, requireReview } = require('../middleware/businessRules');
const { auditLog } = require('../middleware/audit');

router.get('/', getRefundRecords);
router.post('/', checkCardStatus, requireReview, auditLog('create', 'refund'), createRefund);
router.post('/review', auditLog('review', 'refund'), reviewRefund);

module.exports = router;
