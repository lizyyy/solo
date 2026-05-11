const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/pay', paymentController.processPayment);
router.post('/refund', paymentController.processRefund);
router.get('/transactions', paymentController.getTransactions);
router.post('/report-status', paymentController.updateItemReportStatus);

module.exports = router;
