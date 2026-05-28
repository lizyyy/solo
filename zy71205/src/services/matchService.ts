import type {
  BankTransaction,
  Voucher,
  MatchRecord,
  MatchStatus,
  ConflictInfo,
  SplitRecord,
} from '../types';
import {
  generateId,
  fuzzyMatchScore,
  normalizeString,
  amountEquals,
  roundTo,
} from '../utils';
import { dbOperations } from '../db';

type MatchCandidate = {
  transaction: BankTransaction;
  voucher: Voucher;
  score: number;
  reasons: string[];
};

export const calculateMatchScore = (
  transaction: BankTransaction,
  voucher: Voucher
): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];

  const transactionAmount = transaction.debitAmount > 0 
    ? transaction.debitAmount 
    : -transaction.creditAmount;
  const voucherAmount = voucher.debitAmount > 0 
    ? voucher.debitAmount 
    : -voucher.creditAmount;

  if (amountEquals(Math.abs(transactionAmount), Math.abs(voucherAmount))) {
    score += 40;
    reasons.push('金额完全匹配');
  } else {
    const diff = Math.abs(Math.abs(transactionAmount) - Math.abs(voucherAmount));
    const ratio = 1 - (diff / Math.max(Math.abs(transactionAmount), Math.abs(voucherAmount)));
    if (ratio > 0.9) {
      score += Math.floor(ratio * 30);
      reasons.push(`金额匹配度 ${Math.floor(ratio * 100)}%`);
    }
  }

  const summaryScore = fuzzyMatchScore(transaction.summary, voucher.summary);
  if (summaryScore >= 80) {
    score += Math.floor(summaryScore * 0.3);
    reasons.push(`摘要匹配度 ${summaryScore}%`);
  }

  const counterpartyScore = fuzzyMatchScore(transaction.counterparty, voucher.accountName);
  if (counterpartyScore >= 70) {
    score += Math.floor(counterpartyScore * 0.2);
    reasons.push(`交易方匹配度 ${counterpartyScore}%`);
  }

  const transactionKeywords = new Set([
    normalizeString(transaction.summary),
    normalizeString(transaction.counterparty),
  ].filter(Boolean));

  const voucherKeywords = new Set([
    normalizeString(voucher.summary),
    normalizeString(voucher.accountName),
  ].filter(Boolean));

  let keywordMatches = 0;
  transactionKeywords.forEach(k => {
    if (voucherKeywords.has(k)) {
      keywordMatches++;
    }
  });

  if (keywordMatches > 0 && transactionKeywords.size > 0 && voucherKeywords.size > 0) {
    const overlapScore = (keywordMatches / Math.max(transactionKeywords.size, voucherKeywords.size)) * 10;
    score += overlapScore;
    if (overlapScore > 5) {
      reasons.push(`关键词匹配 ${keywordMatches} 个`);
    }
  }

  return { score, reasons };
};

export const detectConflicts = (
  transaction: BankTransaction,
  voucher: Voucher,
  allMatches: MatchRecord[],
  allTransactions: BankTransaction[],
  allVouchers: Voucher[]
): ConflictInfo[] => {
  const conflicts: ConflictInfo[] = [];

  const transactionAmount = transaction.debitAmount > 0 
    ? transaction.debitAmount 
    : -transaction.creditAmount;
  const voucherAmount = voucher.debitAmount > 0 
    ? voucher.debitAmount 
    : -voucher.creditAmount;
  const absTransactionAmount = Math.abs(transactionAmount);
  const absVoucherAmount = Math.abs(voucherAmount);

  if (!amountEquals(absTransactionAmount, absVoucherAmount)) {
    conflicts.push({
      type: 'amount_mismatch',
      severity: 'high',
      description: `金额不匹配：流水 ${absTransactionAmount} vs 凭证 ${absVoucherAmount}，差额 ${roundTo(Math.abs(absTransactionAmount - absVoucherAmount))} 元`,
      resolved: false,
    });
  }

  const txnSummaryNorm = normalizeString(transaction.summary);
  const otherSameSummaryTxns = allTransactions.filter(t => 
    t.id !== transaction.id && 
    normalizeString(t.summary) === txnSummaryNorm
  );

  if (otherSameSummaryTxns.length > 0) {
    for (const otherTxn of otherSameSummaryTxns) {
      const otherTxnAmount = otherTxn.debitAmount > 0 ? otherTxn.debitAmount : -otherTxn.creditAmount;
      if (!amountEquals(absTransactionAmount, Math.abs(otherTxnAmount)) ||
          normalizeString(transaction.counterparty) !== normalizeString(otherTxn.counterparty)) {
        conflicts.push({
          type: 'same_summary',
          severity: 'high',
          description: `摘要同名误配：存在 ${otherSameSummaryTxns.length} 条同摘要流水（${otherSameSummaryTxns.map(t => t.transactionNo).join(', ')}），金额或对方户名不一致，当前匹配可能错误`,
          resolved: false,
        });
        break;
      }
    }
  }

  const vchSummaryNorm = normalizeString(voucher.summary);
  const otherSameSummaryVch = allVouchers.filter(v => 
    v.id !== voucher.id && 
    normalizeString(v.summary) === vchSummaryNorm
  );

  if (otherSameSummaryVch.length > 0 && !conflicts.some(c => c.type === 'same_summary')) {
    for (const otherVch of otherSameSummaryVch) {
      const otherVchAmount = otherVch.debitAmount > 0 ? otherVch.debitAmount : -otherVch.creditAmount;
      if (!amountEquals(absVoucherAmount, Math.abs(otherVchAmount)) ||
          normalizeString(voucher.accountName) !== normalizeString(otherVch.accountName)) {
        conflicts.push({
          type: 'same_summary',
          severity: 'high',
          description: `摘要同名误配：存在 ${otherSameSummaryVch.length} 条同摘要凭证（${otherSameSummaryVch.map(v => v.voucherNo).join(', ')}），金额或科目不一致，当前匹配可能错误`,
          resolved: false,
        });
        break;
      }
    }
  }

  if (transaction.isRedFlush || voucher.isRedFlush) {
    if (transaction.isRedFlush && transaction.originalTransactionNo) {
      const originalTxn = allTransactions.find(t => 
        normalizeString(t.transactionNo) === normalizeString(transaction.originalTransactionNo!)
      );
      if (originalTxn) {
        const originalUsed = allMatches.some(m => 
          m.id !== '' && m.transactionIds.includes(originalTxn.id)
        );
        if (originalUsed) {
          conflicts.push({
            type: 'red_flush_occupied',
            severity: 'high',
            description: `红冲流水的原流水（${originalTxn.transactionNo}）已被其他匹配占用，红冲与原流水可能对应不上`,
            resolved: false,
          });
        }
      }
    }

    if (voucher.isRedFlush && voucher.originalVoucherNo) {
      const originalVch = allVouchers.find(v => 
        normalizeString(v.voucherNo) === normalizeString(voucher.originalVoucherNo!)
      );
      if (originalVch) {
        const originalUsed = allMatches.some(m => 
          m.id !== '' && m.voucherIds.includes(originalVch.id)
        );
        if (originalUsed) {
          conflicts.push({
            type: 'red_flush_occupied',
            severity: 'high',
            description: `红冲凭证的原凭证（${originalVch.voucherNo}）已被其他匹配占用，红冲与原凭证可能对应不上`,
            resolved: false,
          });
        }
      }
    }
  }

  return conflicts;
};

export const findMatchCandidates = (
  transactions: BankTransaction[],
  vouchers: Voucher[],
  existingMatches: MatchRecord[]
): MatchCandidate[] => {
  const candidates: MatchCandidate[] = [];
  const matchedTransactionIds = new Set(
    existingMatches.flatMap(m => m.transactionIds)
  );
  const matchedVoucherIds = new Set(
    existingMatches.flatMap(m => m.voucherIds));

  const unmatchedTransactions = transactions.filter(t => !matchedTransactionIds.has(t.id));
  const unmatchedVouchers = vouchers.filter(v => !matchedVoucherIds.has(v.id));

  for (const transaction of unmatchedTransactions) {
    for (const voucher of unmatchedVouchers) {
      const { score, reasons } = calculateMatchScore(transaction, voucher);
      if (score >= 50) {
        candidates.push({ transaction, voucher, score, reasons });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
};

export const createMatchRecord = (
  batchId: string,
  transactionIds: string[],
  voucherIds: string[],
  matchMethod: 'auto' | 'manual' | 'split' | 'merge',
  score: number,
  transactions: BankTransaction[],
  vouchers: Voucher[],
  existingMatches: MatchRecord[],
  allTransactions: BankTransaction[],
  allVouchers: Voucher[]
): MatchRecord => {
  const totalDebit = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.creditAmount, 0);
  const voucherDebit = vouchers.reduce((sum, v) => sum + v.debitAmount, 0);
  const voucherCredit = vouchers.reduce((sum, v) => sum + v.creditAmount, 0);

  const transactionAmount = totalDebit > 0 ? totalDebit : -totalCredit;
  const voucherAmount = voucherDebit > 0 ? voucherDebit : -voucherCredit;

  const amountDiff = Math.abs(Math.abs(transactionAmount) - Math.abs(voucherAmount));

  let status: MatchStatus = 'matched';
  const conflicts: ConflictInfo[] = [];

  transactions.forEach(t => {
    const tConflicts = detectConflicts(t, vouchers[0], existingMatches, allTransactions, allVouchers);
    conflicts.push(...tConflicts);
  });

  if (conflicts.length > 0) {
    status = 'pending';
  }

  const now = Date.now();

  return {
    id: generateId(),
    batchId,
    transactionIds,
    voucherIds,
    invoiceIds: [],
    contractIds: [],
    matchScore: score,
    matchMethod,
    status,
    totalDebitAmount: totalDebit,
    totalCreditAmount: totalCredit,
    amountDifference: amountDiff,
    conflicts,
    matchHistory: [
      {
        action: matchMethod === 'auto' ? '自动匹配' : '手动匹配',
        operator: '系统',
        timestamp: now,
        details: {
          score,
          transactionCount: transactionIds.length,
          voucherCount: voucherIds.length,
        },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

export const performMatching = async (batchId: string): Promise<MatchRecord[]> => {
  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const vouchers = await dbOperations.vouchers.getByBatch(batchId);
  const existingMatches = await dbOperations.matchRecords.getByBatch(batchId);

  const candidates = findMatchCandidates(transactions, vouchers, existingMatches);

  const usedTransactions = new Set<string>();
  const usedVouchers = new Set<string>();
  const newMatches: MatchRecord[] = [];

  for (const candidate of candidates) {
    if (usedTransactions.has(candidate.transaction.id) || 
        usedVouchers.has(candidate.voucher.id)) {
      continue;
    }

    const match = createMatchRecord(
      batchId,
      [candidate.transaction.id],
      [candidate.voucher.id],
      'auto',
      candidate.score,
      [candidate.transaction],
      [candidate.voucher],
      existingMatches,
      transactions,
      vouchers
    );

    newMatches.push(match);
    usedTransactions.add(candidate.transaction.id);
    usedVouchers.add(candidate.voucher.id);
  }

  if (newMatches.length > 0) {
    await dbOperations.matchRecords.addMany(newMatches);

    const matchedTransactionIds = new Set(
      newMatches.flatMap(m => m.transactionIds)
    );
    const matchedVoucherIds = new Set(
      newMatches.flatMap(m => m.voucherIds)
    );

    const updatedTransactions = transactions
      .filter(t => matchedTransactionIds.has(t.id))
      .map(t => ({ ...t, matched: true }));
    const updatedVouchers = vouchers
      .filter(v => matchedVoucherIds.has(v.id))
      .map(v => ({ ...v, matched: true }));

    if (updatedTransactions.length > 0) {
      await dbOperations.transactions.updateMany(updatedTransactions);
    }
    if (updatedVouchers.length > 0) {
      await dbOperations.vouchers.updateMany(updatedVouchers);
    }
  }

  return newMatches;
};

export const splitTransaction = async (
  transactionId: string,
  splitAmounts: number[],
  batchId: string
): Promise<SplitRecord> => {
  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const original = transactions.find(t => t.id === transactionId);
  if (!original) {
    throw new Error('找不到原始交易记录');
  }

  const totalSplit = splitAmounts.reduce((sum, a) => sum + a, 0);
  const originalAmount = original.debitAmount > 0 
    ? original.debitAmount 
    : original.creditAmount;

  if (!amountEquals(totalSplit, originalAmount)) {
    throw new Error(`拆分金额总和 ${totalSplit} 与原金额 ${originalAmount} 不相等`);
  }

  const splitTransactions: BankTransaction[] = splitAmounts.map((amount, index) => {
    const now = Date.now();
    return {
      ...original,
      id: generateId(),
      debitAmount: original.debitAmount > 0 ? amount : 0,
      creditAmount: original.creditAmount > 0 ? amount : 0,
      summary: `${original.summary} (拆分${index + 1}/${splitAmounts.length})`,
      matched: false,
      createdAt: now,
      updatedAt: now,
    };
  });

  await dbOperations.transactions.addMany(splitTransactions);

  const splitRecord: SplitRecord = {
    id: generateId(),
    originalTransactionId: transactionId,
    splitTransactions: splitTransactions.map(t => t.id),
    splitRatios: splitAmounts.map(a => roundTo(a / originalAmount, 4)),
    splitAmounts,
    createdBy: '用户',
    createdAt: Date.now(),
  };

  await dbOperations.splitRecords.add(splitRecord);

  return splitRecord;
};

export const mergeTransactions = async (
  transactionIds: string[],
  batchId: string
): Promise<BankTransaction> => {
  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const toMerge = transactions.filter(t => transactionIds.includes(t.id));
  
  if (toMerge.length < 2) {
    throw new Error('至少需要选择2条记录进行合并');
  }

  const merged: BankTransaction = {
    id: generateId(),
    batchId,
    sourceId: toMerge[0].sourceId,
    transactionDate: toMerge[0].transactionDate,
    transactionNo: `MERGED-${Date.now()}`,
    summary: `合并: ${toMerge.map(t => t.summary).join(' + ')}`,
    debitAmount: toMerge.reduce((sum, t) => sum + t.debitAmount, 0),
    creditAmount: toMerge.reduce((sum, t) => sum + t.creditAmount, 0),
    balance: 0,
    counterparty: toMerge[0].counterparty,
    counterpartyAccount: toMerge[0].counterpartyAccount,
    remark: `合并自 ${toMerge.length} 条记录`,
    isRedFlush: false,
    matched: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await dbOperations.transactions.addMany([merged]);

  const mergeRecord = {
    id: generateId(),
    mergedTransactionIds: transactionIds,
    resultTransactionId: merged.id,
    createdBy: '用户',
    createdAt: Date.now(),
  };

  await dbOperations.mergeRecords.add(mergeRecord);

  return merged;
};

export const manualMatch = async (
  batchId: string,
  transactionIds: string[],
  voucherIds: string[]
): Promise<MatchRecord> => {
  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const vouchers = await dbOperations.vouchers.getByBatch(batchId);
  const existingMatches = await dbOperations.matchRecords.getByBatch(batchId);

  const matchedTransactions = transactions.filter(t => transactionIds.includes(t.id));
  const matchedVouchers = vouchers.filter(v => voucherIds.includes(v.id));

  const match = createMatchRecord(
    batchId,
    transactionIds,
    voucherIds,
    'manual',
    100,
    matchedTransactions,
    matchedVouchers,
    existingMatches,
    transactions,
    vouchers
  );

  await dbOperations.matchRecords.addMany([match]);

  const updatedTransactions = matchedTransactions.map(t => ({ ...t, matched: true }));
  const updatedVouchers = matchedVouchers.map(v => ({ ...v, matched: true }));

  await dbOperations.transactions.updateMany(updatedTransactions);
  await dbOperations.vouchers.updateMany(updatedVouchers);

  return match;
};

export const updateBatchStatistics = async (batchId: string): Promise<void> => {
  const batch = await dbOperations.batches.get(batchId);
  if (!batch) return;

  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const vouchers = await dbOperations.vouchers.getByBatch(batchId);
  const invoices = await dbOperations.invoices.getByBatch(batchId);
  const contracts = await dbOperations.contracts.getByBatch(batchId);
  const matchRecords = await dbOperations.matchRecords.getByBatch(batchId);
  const importConflicts = await dbOperations.importConflicts.getByBatch(batchId);

  batch.statistics = {
    totalTransactions: transactions.length,
    totalVouchers: vouchers.length,
    totalInvoices: invoices.length,
    totalContracts: contracts.length,
    matchedCount: matchRecords.filter(m => m.status === 'matched' || m.status === 'confirmed').length,
    pendingCount: matchRecords.filter(m => m.status === 'pending').length,
    unmatchedCount: transactions.filter(t => !t.matched).length + vouchers.filter(v => !v.matched).length,
    conflictCount: matchRecords.filter(m => m.conflicts.length > 0).length + importConflicts.length,
    confirmedCount: matchRecords.filter(m => m.status === 'confirmed').length,
  };

  await dbOperations.batches.update(batch);
};
