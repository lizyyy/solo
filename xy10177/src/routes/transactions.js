const express = require('express');
const router = express.Router();
const { errorResponse, successResponse } = require('../utils');
const {
  getTransaction,
  getTransactionWithSteps,
  listTransactions,
} = require('../services/transactionService');

router.get('/', (req, res) => {
  const { meeting_id, status } = req.query;
  const transactions = listTransactions(meeting_id, status);
  successResponse(res, { transactions });
});

router.get('/:id', (req, res) => {
  const transaction = getTransactionWithSteps(req.params.id);
  if (!transaction) {
    return errorResponse(res, 404, 'Transaction not found');
  }
  
  const parsedSteps = transaction.steps.map(s => ({
    ...s,
    result: s.result ? JSON.parse(s.result) : null,
  }));
  
  successResponse(res, {
    transaction: {
      ...transaction,
      steps: parsedSteps,
    },
  });
});

module.exports = router;
