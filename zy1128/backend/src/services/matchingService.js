import expectedPayoutModel from '../models/expectedPayoutModel.js';
import transactionModel from '../models/transactionModel.js';
import reconciliationModel from '../models/reconciliationModel.js';
import { getDifferenceType, calculateDifference, roundAmount } from '../utils/calculationUtils.js';
import db from '../config/database.js';

const TOLERANCE = 0.01;

export const runAutoMatching = (filters = {}) => {
  const pendingPayouts = expectedPayoutModel.findAll({
    ...filters,
    status: 'pending'
  });

  const unmatchedTransactions = transactionModel.findUnmatched(filters.account_id);

  const results = {
    matched: [],
    unmatched: [],
    errors: []
  };

  db.transaction(() => {
    pendingPayouts.forEach(payout => {
      try {
        const matchResult = findMatchForPayout(payout, unmatchedTransactions);
        
        if (matchResult) {
          const reconciliation = createReconciliation(payout, matchResult.transaction, matchResult.differenceType);
          results.matched.push({
            payout_id: payout.id,
            transaction_id: matchResult.transaction.id,
            reconciliation_id: reconciliation.id,
            difference_type: matchResult.differenceType
          });
          
          const idx = unmatchedTransactions.findIndex(t => t.id === matchResult.transaction.id);
          if (idx !== -1) {
            unmatchedTransactions.splice(idx, 1);
          }
        } else {
          const reconciliation = createUnmatchedReconciliation(payout);
          results.unmatched.push({
            payout_id: payout.id,
            reconciliation_id: reconciliation.id
          });
        }
      } catch (e) {
        results.errors.push({
          payout_id: payout.id,
          error: e.message
        });
      }
    });
  })();

  return {
    success: true,
    totalPayouts: pendingPayouts.length,
    matchedCount: results.matched.length,
    unmatchedCount: results.unmatched.length,
    errorCount: results.errors.length,
    details: results
  };
};

const findMatchForPayout = (payout, transactions) => {
  const expectedAmount = payout.expected_total;
  const accountId = payout.account_id;

  const candidates = transactions.filter(t => {
    if (accountId && t.account_id !== accountId) return false;
    return Math.abs(t.transaction_amount - expectedAmount) <= TOLERANCE;
  });

  if (candidates.length === 0) {
    return null;
  }

  const payoutDate = new Date(payout.payout_date);
  
  candidates.sort((a, b) => {
    const dateDiffA = Math.abs(new Date(a.transaction_date) - payoutDate);
    const dateDiffB = Math.abs(new Date(b.transaction_date) - payoutDate);
    return dateDiffA - dateDiffB;
  });

  const bestMatch = candidates[0];
  const differenceType = getDifferenceType(expectedAmount, bestMatch.transaction_amount, TOLERANCE);

  return {
    transaction: bestMatch,
    differenceType
  };
};

const createReconciliation = (payout, transaction, differenceType) => {
  const expectedAmount = payout.expected_total;
  const actualAmount = transaction.transaction_amount;
  const difference = calculateDifference(expectedAmount, actualAmount);

  transactionModel.markAsMatched(transaction.id);
  expectedPayoutModel.updateStatus(payout.id, differenceType === 'matched' ? 'matched' : 
    differenceType === 'underpaid' ? 'underpaid' : 
    differenceType === 'overpaid' ? 'overpaid' : 'partially_matched');

  return reconciliationModel.create({
    expected_payout_id: payout.id,
    transaction_id: transaction.id,
    expected_amount: expectedAmount,
    actual_amount: actualAmount,
    difference: difference,
    difference_type: differenceType
  });
};

const createUnmatchedReconciliation = (payout) => {
  expectedPayoutModel.updateStatus(payout.id, 'unmatched');

  return reconciliationModel.create({
    expected_payout_id: payout.id,
    transaction_id: null,
    expected_amount: payout.expected_total,
    actual_amount: null,
    difference: null,
    difference_type: 'unmatched'
  });
};

export const manualMatch = (expectedPayoutId, transactionId) => {
  const payout = expectedPayoutModel.findById(expectedPayoutId);
  if (!payout) {
    return { success: false, error: '应到账记录不存在' };
  }

  const transaction = transactionModel.findById(transactionId);
  if (!transaction) {
    return { success: false, error: '交易记录不存在' };
  }

  if (transaction.matched) {
    return { success: false, error: '该交易已被匹配' };
  }

  const existingReconciliation = reconciliationModel.findByExpectedPayoutId(expectedPayoutId);
  if (existingReconciliation.length > 0) {
    db.transaction(() => {
      existingReconciliation.forEach(r => {
        if (r.transaction_id) {
          transactionModel.markAsUnmatched(r.transaction_id);
        }
        reconciliationModel.delete(r.id);
      });
    })();
  }

  const expectedAmount = payout.expected_total;
  const actualAmount = transaction.transaction_amount;
  const difference = calculateDifference(expectedAmount, actualAmount);
  const differenceType = getDifferenceType(expectedAmount, actualAmount, TOLERANCE);

  let result;
  db.transaction(() => {
    transactionModel.markAsMatched(transactionId);
    expectedPayoutModel.updateStatus(expectedPayoutId, differenceType === 'matched' ? 'matched' : 
      differenceType === 'underpaid' ? 'underpaid' : 
      differenceType === 'overpaid' ? 'overpaid' : 'partially_matched');

    result = reconciliationModel.create({
      expected_payout_id: expectedPayoutId,
      transaction_id: transactionId,
      expected_amount: expectedAmount,
      actual_amount: actualAmount,
      difference: difference,
      difference_type: 'manual'
    });
  })();

  return {
    success: true,
    reconciliation: result,
    difference,
    differenceType: 'manual'
  };
};

export const unmatch = (reconciliationId) => {
  const reconciliation = reconciliationModel.findById(reconciliationId);
  if (!reconciliation) {
    return { success: false, error: '核对记录不存在' };
  }

  db.transaction(() => {
    if (reconciliation.transaction_id) {
      transactionModel.markAsUnmatched(reconciliation.transaction_id);
    }
    expectedPayoutModel.updateStatus(reconciliation.expected_payout_id, 'pending');
    reconciliationModel.delete(reconciliationId);
  })();

  return { success: true };
};

export const addManualAdjustment = (reconciliationId, adjustmentNote) => {
  const reconciliation = reconciliationModel.findById(reconciliationId);
  if (!reconciliation) {
    return { success: false, error: '核对记录不存在' };
  }

  const updated = reconciliationModel.update(reconciliationId, {
    ...reconciliation,
    manual_adjustment: adjustmentNote,
    difference_type: 'manual'
  });

  return { success: true, reconciliation: updated };
};

export const getMatchingStats = (filters = {}) => {
  const stats = {
    total: expectedPayoutModel.count(),
    pending: expectedPayoutModel.count({ status: 'pending' }),
    matched: expectedPayoutModel.count({ status: 'matched' }),
    unmatched: expectedPayoutModel.count({ status: 'unmatched' }),
    underpaid: expectedPayoutModel.count({ status: 'underpaid' }),
    overpaid: expectedPayoutModel.count({ status: 'overpaid' }),
    partially_matched: expectedPayoutModel.count({ status: 'partially_matched' })
  };

  return stats;
};

export default {
  runAutoMatching,
  manualMatch,
  unmatch,
  addManualAdjustment,
  getMatchingStats
};
