import { getVouchersBySource } from '../models/Voucher.js';
import { getTransactionsBySource, TRANSACTION_TYPES } from '../models/Transaction.js';
import { VOUCHER_TYPES } from '../models/Voucher.js';

export async function reconcile(sourceId, startDate = null, endDate = null, externalData = null) {
  const vouchers = await getVouchersBySource(sourceId, startDate, endDate);
  const transactions = await getTransactionsBySource(sourceId, startDate, endDate);

  const stats = {
    totalIssued: 0,
    totalBound: 0,
    totalUsed: 0,
    totalRefunded: 0,
    bankVouchers: 0,
    corporateVouchers: 0,
    totalAmount: 0
  };

  vouchers.forEach(v => {
    if (v.type === VOUCHER_TYPES.BANK) stats.bankVouchers++;
    if (v.type === VOUCHER_TYPES.CORPORATE) stats.corporateVouchers++;
    stats.totalAmount += v.amount;
  });

  transactions.forEach(t => {
    switch (t.type) {
      case TRANSACTION_TYPES.ISSUE:
        stats.totalIssued++;
        break;
      case TRANSACTION_TYPES.BIND:
        stats.totalBound++;
        break;
      case TRANSACTION_TYPES.USE:
        stats.totalUsed++;
        break;
      case TRANSACTION_TYPES.REFUND:
        stats.totalRefunded++;
        break;
    }
  });

  const differences = [];

  if (externalData) {
    if (externalData.totalUsed !== undefined && externalData.totalUsed !== stats.totalUsed) {
      differences.push({
        type: 'used_count_mismatch',
        expected: externalData.totalUsed,
        actual: stats.totalUsed,
        difference: stats.totalUsed - externalData.totalUsed
      });
    }

    if (externalData.totalRefunded !== undefined && externalData.totalRefunded !== stats.totalRefunded) {
      differences.push({
        type: 'refund_count_mismatch',
        expected: externalData.totalRefunded,
        actual: stats.totalRefunded,
        difference: stats.totalRefunded - externalData.totalRefunded
      });
    }

    if (externalData.totalAmount !== undefined && externalData.totalAmount !== stats.totalAmount) {
      differences.push({
        type: 'amount_mismatch',
        expected: externalData.totalAmount,
        actual: stats.totalAmount,
        difference: stats.totalAmount - externalData.totalAmount
      });
    }
  }

  return {
    success: true,
    sourceId,
    period: { startDate, endDate },
    statistics: stats,
    differences,
    reconciledAt: new Date().toISOString()
  };
}

export async function getReconciliationDetails(sourceId, startDate = null, endDate = null) {
  const vouchers = await getVouchersBySource(sourceId, startDate, endDate);
  const transactions = await getTransactionsBySource(sourceId, startDate, endDate);

  const usedVouchers = vouchers.filter(v => v.status === 'used');
  const refundedVouchers = vouchers.filter(v => v.status === 'refunded');

  return {
    success: true,
    vouchers: {
      total: vouchers.length,
      used: usedVouchers.length,
      refunded: refundedVouchers.length,
      list: vouchers
    },
    transactions: {
      total: transactions.length,
      list: transactions
    }
  };
}