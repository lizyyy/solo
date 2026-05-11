const express = require('express');
const router = express.Router();
const depositController = require('../controllers/deposit.controller');

router.get('/', depositController.getAllTransactions);
router.get('/summary', depositController.getDepositSummary);
router.get('/:id', depositController.getTransactionById);
router.post('/:id/confirm', depositController.confirmPayment);

module.exports = router;