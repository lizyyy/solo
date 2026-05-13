const express = require('express');
const router = express.Router();
const { 
  getTransactions, 
  createTransaction, 
  getDuplicateDeductions, 
  handleDuplicateDeduction 
} = require('../controllers/transactionController');
const { checkCardStatus, checkIdempotency, detectDuplicateTransaction } = require('../middleware/businessRules');
const { auditLog } = require('../middleware/audit');

router.get('/', getTransactions);
router.post('/', 
  checkCardStatus, 
  checkIdempotency('offline_transactions'), 
  detectDuplicateTransaction, 
  auditLog('create', 'transaction'), 
  createTransaction
);
router.get('/duplicates', getDuplicateDeductions);
router.post('/duplicates/handle', auditLog('handle', 'duplicate'), handleDuplicateDeduction);

module.exports = router;
