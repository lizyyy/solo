import db, { Transaction, VersionHistory } from '../database';
import { TransactionData, ReviewRequest, PaginatedResponse } from '../types';
import { calculateRiskScore, generateExplanations, isAnomaly } from './anomalyExplainer';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

}

export function importTransaction(txData: TransactionData, operator: string = 'system'): {
  transaction: Transaction;
  explanations: ReturnType<typeof generateExplanations>;
} {
  const existing = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(txData.transaction_id);
  if (existing) {
    throw new Error(`交易 ${txData.transaction_id} 已存在`);
  }

  const riskScore = txData.risk_score ?? calculateRiskScore(txData);
  const anomaly = isAnomaly(riskScore);
  const now = new Date().toISOString();

  const tx: Transaction = {
    id: generateId(),
    transaction_id: txData.transaction_id,
    amount: txData.amount,
    merchant: txData.merchant || '',
    category: txData.category || '',
    country: txData.country || '',
    device_id: txData.device_id || '',
    user_id: txData.user_id || '',
    transaction_time: txData.transaction_time,
    is_first_transaction: txData.is_first_transaction || 0,
    is_weekend: txData.is_weekend || 0,
    is_night: txData.is_night || 0,
    velocity_24h: txData.velocity_24h || 0,
    amount_deviation: txData.amount_deviation || 0,
    risk_score: riskScore,
    is_anomaly: anomaly ? 1 : 0,
    created_at: now,
  };

  const explanations = generateExplanations(txData, riskScore);

  const insertTx = db.prepare(`
    INSERT INTO transactions (
      id, transaction_id, amount, merchant, category, country, device_id, user_id,
      transaction_time, is_first_transaction, is_weekend, is_night, velocity_24h,
      amount_deviation, risk_score, is_anomaly, reviewed, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  const insertExp = db.prepare(`
    INSERT INTO explanations (id, transaction_id, feature, feature_value, contribution, threshold, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVersion = db.prepare(`
    INSERT INTO version_history (id, transaction_id, action, old_value, new_value, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const txDb = db.transaction(() => {
    insertTx.run(
      tx.id, tx.transaction_id, tx.amount, tx.merchant, tx.category, tx.country,
      tx.device_id, tx.user_id, tx.transaction_time, tx.is_first_transaction,
      tx.is_weekend, tx.is_night, tx.velocity_24h, tx.amount_deviation,
      tx.risk_score, tx.is_anomaly, tx.created_at
    );

    for (const exp of explanations) {
      insertExp.run(
        exp.id, exp.transaction_id, exp.feature, exp.feature_value,
        exp.contribution, exp.threshold, exp.reason, exp.created_at
      );
    }

    insertVersion.run(
      generateId(), tx.transaction_id, 'import', '',
      `风险评分: ${riskScore.toFixed(1)}, 异常标记: ${anomaly ? '是' : '否'}`,
      operator, now
    );
  });

  txDb();

  return { transaction: tx, explanations };
}

export function importBatchTransactions(
  txDataList: TransactionData[],
  operator: string = 'system'
): { success: number; failed: number; errors: string[] } {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const txData of txDataList) {
    try {
      importTransaction(txData, operator);
      success++;
    } catch (err) {
      failed++;
      errors.push(`交易 ${txData.transaction_id}: ${(err as Error).message}`);
    }
  }

  return { success, failed, errors };
}

export function getTransactions(
  page: number = 1,
  pageSize: number = 20,
  filters: {
    is_anomaly?: boolean;
    reviewed?: boolean;
    review_decision?: 'confirmed' | 'rejected';
    min_score?: number;
    max_score?: number;
    search?: string;
  } = {}
): PaginatedResponse<Transaction & { review_decision?: string; reviewed?: number }> {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.is_anomaly !== undefined) {
    conditions.push('is_anomaly = ?');
    params.push(filters.is_anomaly ? 1 : 0);
  }

  if (filters.reviewed !== undefined) {
    conditions.push('reviewed = ?');
    params.push(filters.reviewed ? 1 : 0);
  }

  if (filters.review_decision) {
    conditions.push('review_decision = ?');
    params.push(filters.review_decision);
  }

  if (filters.min_score !== undefined) {
    conditions.push('risk_score >= ?');
    params.push(filters.min_score);
  }

  if (filters.max_score !== undefined) {
    conditions.push('risk_score <= ?');
    params.push(filters.max_score);
  }

  if (filters.search) {
    conditions.push('(transaction_id LIKE ? OR user_id LIKE ? OR merchant LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) as total FROM transactions ${whereClause}`;
  const countResult = db.prepare(countQuery).get(...params) as { total: number };

  const dataQuery = `
    SELECT * FROM transactions ${whereClause}
    ORDER BY risk_score DESC, created_at DESC
    LIMIT ? OFFSET ?
  `;

  const data = db.prepare(dataQuery).all(...params, pageSize, offset) as (Transaction & {
    reviewed?: number;
    review_decision?: string;
    review_comment?: string;
    reviewer?: string;
    reviewed_at?: string;
  })[];

  return {
    data,
    total: countResult.total,
    page,
    pageSize,
  };
}

export function getTransaction(transactionId: string): Transaction | undefined {
  return db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId) as Transaction | undefined;
}

export function getExplanations(transactionId: string) {
  return db.prepare('SELECT * FROM explanations WHERE transaction_id = ? ORDER BY contribution DESC').all(transactionId);
}

export function reviewTransaction(request: ReviewRequest): void {
  const tx = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(request.transaction_id);
  if (!tx) {
    throw new Error(`交易 ${request.transaction_id} 不存在`);
  }

  const now = new Date().toISOString();
  const txObj = tx as any;
  const oldValue = txObj.reviewed
    ? `已复核: ${txObj.review_decision || '未知'}`
    : '未复核';

  const update = db.prepare(`
    UPDATE transactions SET
      reviewed = 1,
      review_decision = ?,
      review_comment = ?,
      reviewer = ?,
      reviewed_at = ?
    WHERE transaction_id = ?
  `);

  const insertVersion = db.prepare(`
    INSERT INTO version_history (id, transaction_id, action, old_value, new_value, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const txDb = db.transaction(() => {
    update.run(
      request.decision,
      request.comment,
      request.reviewer,
      now,
      request.transaction_id
    );

    insertVersion.run(
      generateId(),
      request.transaction_id,
      'review',
      oldValue,
      `复核: ${request.decision}`,
      request.reviewer,
      now
    );
  });

  txDb();
}

export function rollbackTransaction(transactionId: string, operator: string): void {
  const tx = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId);
  if (!tx) {
    throw new Error(`交易 ${transactionId} 不存在`);
  }

  const txObj = tx as any;
  if (!txObj.reviewed) {
    throw new Error(`交易 ${transactionId} 尚未复核，无需回滚`);
  }

  const now = new Date().toISOString();
  const oldValue = `已复核: ${txObj.review_decision || '未知'}`;

  const update = db.prepare(`
    UPDATE transactions SET
      reviewed = 0,
      review_decision = NULL,
      review_comment = NULL,
      reviewer = NULL,
      reviewed_at = NULL
    WHERE transaction_id = ?
  `);

  const insertVersion = db.prepare(`
    INSERT INTO version_history (id, transaction_id, action, old_value, new_value, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const txDb = db.transaction(() => {
    update.run(transactionId);
    insertVersion.run(
      generateId(),
      transactionId,
      'rollback',
      oldValue,
      '回滚为未复核状态',
      operator,
      now
    );
  });

  txDb();
}

export function getVersionHistory(transactionId: string): VersionHistory[] {
  return db.prepare(`
    SELECT * FROM version_history
    WHERE transaction_id = ?
    ORDER BY created_at DESC
  `).all(transactionId) as VersionHistory[];
}

export function getStatistics() {
  const total = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
  const anomalies = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE is_anomaly = 1').get() as { count: number };
  const reviewed = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE reviewed = 1').get() as { count: number };
  const confirmed = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE review_decision = ?').get('confirmed') as { count: number };
  const rejected = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE review_decision = ?').get('rejected') as { count: number };
  const avgScore = db.prepare('SELECT AVG(risk_score) as avg FROM transactions').get() as { avg: number };

  return {
    total: total.count,
    anomalies: anomalies.count,
    reviewed: reviewed.count,
    confirmed: confirmed.count,
    rejected: rejected.count,
    unreviewed: anomalies.count - reviewed.count,
    avg_score: avgScore.avg || 0,
  };
}

export function getAllTransactionsForExport(filters: {
  start_date?: string;
  end_date?: string;
  status?: string;
} = {}) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.start_date) {
    conditions.push('created_at >= ?');
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    conditions.push('created_at <= ?');
    params.push(filters.end_date);
  }

  if (filters.status === 'reviewed') {
    conditions.push('reviewed = 1');
  } else if (filters.status === 'unreviewed') {
    conditions.push('reviewed = 0');
  } else if (filters.status === 'confirmed') {
    conditions.push('review_decision = ?');
    params.push('confirmed');
  } else if (filters.status === 'rejected') {
    conditions.push('review_decision = ?');
    params.push('rejected');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      t.transaction_id,
      t.amount,
      t.merchant,
      t.category,
      t.country,
      t.user_id,
      t.transaction_time,
      t.risk_score,
      t.is_anomaly,
      t.reviewed,
      t.review_decision,
      t.review_comment,
      t.reviewer,
      t.reviewed_at,
      t.created_at
    FROM transactions t
    ${whereClause}
    ORDER BY t.risk_score DESC, t.created_at DESC
  `).all(...params);
}
