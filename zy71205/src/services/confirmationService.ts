import type { MatchRecord, ManualConfirmation } from '../types';
import { generateId } from '../utils';
import { dbOperations } from '../db';

export const confirmMatch = async (
  matchRecordId: string,
  batchId: string,
  comment: string = ''
): Promise<void> => {
  const matches = await dbOperations.matchRecords.getByBatch(batchId);
  const match = matches.find(m => m.id === matchRecordId);
  
  if (!match) {
    throw new Error('找不到匹配记录');
  }

  const now = Date.now();

  const confirmation: ManualConfirmation = {
    id: generateId(),
    matchRecordId,
    operator: '当前用户',
    action: 'confirm',
    comment,
    createdAt: now,
  };

  await dbOperations.confirmations.add(confirmation);

  match.status = 'confirmed';
  match.confirmedBy = '当前用户';
  match.confirmedAt = now;
  match.matchHistory.push({
    action: '人工确认',
    operator: '当前用户',
    timestamp: now,
    details: { comment },
  });

  match.conflicts = match.conflicts.map(c => ({ ...c, resolved: true }));

  await dbOperations.matchRecords.update(match);
};

export const rejectMatch = async (
  matchRecordId: string,
  batchId: string,
  comment: string = ''
): Promise<void> => {
  const matches = await dbOperations.matchRecords.getByBatch(batchId);
  const match = matches.find(m => m.id === matchRecordId);
  
  if (!match) {
    throw new Error('找不到匹配记录');
  }

  const now = Date.now();

  const confirmation: ManualConfirmation = {
    id: generateId(),
    matchRecordId,
    operator: '当前用户',
    action: 'reject',
    comment,
    createdAt: now,
  };

  await dbOperations.confirmations.add(confirmation);

  match.status = 'rejected';
  match.matchHistory.push({
    action: '人工拒绝',
    operator: '当前用户',
    timestamp: now,
    details: { comment },
  });

  await dbOperations.matchRecords.update(match);

  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const vouchers = await dbOperations.vouchers.getByBatch(batchId);

  const updatedTransactions = transactions
    .filter(t => match.transactionIds.includes(t.id))
    .map(t => ({ ...t, matched: false }));
  const updatedVouchers = vouchers
    .filter(v => match.voucherIds.includes(v.id))
    .map(v => ({ ...v, matched: false }));

  if (updatedTransactions.length > 0) {
    await dbOperations.transactions.updateMany(updatedTransactions);
  }
  if (updatedVouchers.length > 0) {
    await dbOperations.vouchers.updateMany(updatedVouchers);
  }
};

export const adjustMatch = async (
  matchRecordId: string,
  batchId: string,
  newTransactionIds: string[],
  newVoucherIds: string[],
  comment: string = ''
): Promise<void> => {
  const matches = await dbOperations.matchRecords.getByBatch(batchId);
  const match = matches.find(m => m.id === matchRecordId);
  
  if (!match) {
    throw new Error('找不到匹配记录');
  }

  const now = Date.now();

  const confirmation: ManualConfirmation = {
    id: generateId(),
    matchRecordId,
    operator: '当前用户',
    action: 'adjust',
    comment,
    adjustments: {
      transactionIds: newTransactionIds,
      voucherIds: newVoucherIds,
    },
    createdAt: now,
  };

  await dbOperations.confirmations.add(confirmation);

  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const vouchers = await dbOperations.vouchers.getByBatch(batchId);

  const oldTransactionIds = new Set(match.transactionIds);
  const oldVoucherIds = new Set(match.voucherIds);

  const releasedTransactions = transactions.filter(t => oldTransactionIds.has(t.id));
  const releasedVouchers = vouchers.filter(v => oldVoucherIds.has(v.id));

  await dbOperations.transactions.updateMany(
    releasedTransactions.map(t => ({ ...t, matched: false }))
  );
  await dbOperations.vouchers.updateMany(
    releasedVouchers.map(v => ({ ...v, matched: false }))
  );

  match.transactionIds = newTransactionIds;
  match.voucherIds = newVoucherIds;
  match.status = 'confirmed';
  match.confirmedBy = '当前用户';
  match.confirmedAt = now;
  match.matchMethod = 'manual';
  match.matchScore = 100;
  match.matchHistory.push({
    action: '人工调整',
    operator: '当前用户',
    timestamp: now,
    details: {
      comment,
      oldTransactionIds: Array.from(oldTransactionIds),
      newTransactionIds,
      oldVoucherIds: Array.from(oldVoucherIds),
      newVoucherIds,
    },
  });

  const totalDebit = transactions
    .filter(t => newTransactionIds.includes(t.id))
    .reduce((sum, t) => sum + t.debitAmount, 0);
  const totalCredit = transactions
    .filter(t => newTransactionIds.includes(t.id))
    .reduce((sum, t) => sum + t.creditAmount, 0);

  match.totalDebitAmount = totalDebit;
  match.totalCreditAmount = totalCredit;
  match.amountDifference = 0;
  match.conflicts = [];

  await dbOperations.matchRecords.update(match);

  const newlyMatchedTransactions = transactions.filter(t => newTransactionIds.includes(t.id));
  const newlyMatchedVouchers = vouchers.filter(v => newVoucherIds.includes(v.id));

  await dbOperations.transactions.updateMany(
    newlyMatchedTransactions.map(t => ({ ...t, matched: true }))
  );
  await dbOperations.vouchers.updateMany(
    newlyMatchedVouchers.map(v => ({ ...v, matched: true }))
  );
};

export const getPendingMatches = async (batchId: string): Promise<MatchRecord[]> => {
  const matches = await dbOperations.matchRecords.getByBatch(batchId);
  return matches.filter(m => m.status === 'pending' || m.conflicts.some(c => !c.resolved));
};

export const getConflictMatches = async (batchId: string): Promise<MatchRecord[]> => {
  const matches = await dbOperations.matchRecords.getByBatch(batchId);
  return matches.filter(m => m.conflicts.length > 0);
};

export const batchConfirm = async (
  matchRecordIds: string[],
  batchId: string,
  comment: string = ''
): Promise<void> => {
  for (const id of matchRecordIds) {
    await confirmMatch(id, batchId, comment);
  }
};

export const batchReject = async (
  matchRecordIds: string[],
  batchId: string,
  comment: string = ''
): Promise<void> => {
  for (const id of matchRecordIds) {
    await rejectMatch(id, batchId, comment);
  }
};
