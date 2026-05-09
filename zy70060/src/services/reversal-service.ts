import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, getAll, beginTransaction, commitTransaction, rollbackTransaction } from '../utils/db-helpers';
import { ReversalRecord, ReversalStatus, Transaction } from '../types';
import { transactionService } from './transaction-service';
import { quotaLedgerService } from './quota-ledger-service';
import { failedOperationService } from './failed-operation-service';

interface ReversalRecordRow {
  id: string;
  original_transaction_id: string;
  transaction_id: string;
  reason: string;
  status: string;
  retry_count: number;
  last_retry_at: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export const reversalService = {
  async createReversal(
    originalTransactionId: string,
    reason: string
  ): Promise<ReversalRecord> {
    const originalTransaction = await transactionService.getTransactionById(originalTransactionId);

    if (originalTransaction.status !== 'SUCCESS') {
      throw new Error(`只能冲正 SUCCESS 状态的交易，当前状态: ${originalTransaction.status}`);
    }

    const id = uuidv4();
    const now = dayjs().toISOString();

    await runQuery(
      `INSERT INTO reversal_records (
        id, original_transaction_id, transaction_id, reason, 
        status, retry_count, last_retry_at, error_message, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, originalTransactionId, null, reason, 'PENDING', 0, null, null, now, now]
    );

    return this.executeReversal(id);
  },

  async executeReversal(reversalId: string): Promise<ReversalRecord> {
    const reversalRecord = await this.getReversalById(reversalId);

    if (reversalRecord.status === 'SUCCESS') {
      return reversalRecord;
    }

    const originalTransaction = await transactionService.getTransactionById(
      reversalRecord.originalTransactionId
    );

    await beginTransaction();

    try {
      const year = dayjs(originalTransaction.createdAt).year();
      await quotaLedgerService.releaseQuota(
        originalTransaction.customerId,
        originalTransaction.rmbAmount,
        year
      );

      const reversalTransactionId = uuidv4();
      const now = dayjs().toISOString();

      const reversalType = originalTransaction.type === 'BUY' ? 'SELL' : 'BUY';

      await runQuery(
        `INSERT INTO transactions (
          id, idempotent_key, customer_id, type, currency, 
          foreign_currency_amount, rmb_amount, rate_snapshot_id, 
          quota_ledger_id, status, remark, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reversalTransactionId,
          `REVERSAL_${originalTransaction.idempotentKey}`,
          originalTransaction.customerId,
          reversalType,
          originalTransaction.currency,
          -originalTransaction.foreignCurrencyAmount,
          -originalTransaction.rmbAmount,
          originalTransaction.rateSnapshotId,
          originalTransaction.quotaLedgerId,
          'REVERSED',
          `冲正原交易: ${originalTransaction.id}`,
          now,
          now
        ]
      );

      await runQuery(
        `UPDATE transactions 
         SET status = 'REVERSED', updated_at = ? 
         WHERE id = ?`,
        [now, originalTransaction.id]
      );

      await this.updateReversalStatus(
        reversalId,
        'SUCCESS',
        reversalTransactionId,
        null
      );

      await commitTransaction();

      return this.getReversalById(reversalId);
    } catch (error) {
      await rollbackTransaction();
      await this.updateReversalStatus(
        reversalId,
        'FAILED',
        null,
        error instanceof Error ? error.message : '未知错误'
      );
      await failedOperationService.createOperation(
        'REVERSAL',
        JSON.stringify({ reversalId }),
        error instanceof Error ? error.message : '未知错误'
      );
      throw error;
    }
  },

  async getReversalById(id: string): Promise<ReversalRecord> {
    const row = await getOne<ReversalRecordRow>(
      'SELECT * FROM reversal_records WHERE id = ?',
      [id]
    );

    if (!row) {
      throw new Error(`冲正记录不存在: ${id}`);
    }

    return this.rowToReversal(row);
  },

  async getReversalsByTransaction(transactionId: string): Promise<ReversalRecord[]> {
    const rows = await getAll<ReversalRecordRow>(
      'SELECT * FROM reversal_records WHERE original_transaction_id = ? ORDER BY created_at DESC',
      [transactionId]
    );

    return rows.map(this.rowToReversal);
  },

  async getFailedReversals(): Promise<ReversalRecord[]> {
    const rows = await getAll<ReversalRecordRow>(
      `SELECT * FROM reversal_records 
       WHERE status IN ('FAILED', 'RETRY_PENDING') 
       ORDER BY last_retry_at ASC`
    );

    return rows.map(this.rowToReversal);
  },

  async retryFailedReversals(): Promise<{ success: number; failed: number }> {
    const failedReversals = await this.getFailedReversals();
    let success = 0;
    let failed = 0;

    for (const reversal of failedReversals) {
      try {
        await this.executeReversal(reversal.id);
        success++;
      } catch (error) {
        failed++;
      }
    }

    return { success, failed };
  },

  async updateReversalStatus(
    id: string,
    status: ReversalStatus,
    transactionId: string | null,
    errorMessage: string | null
  ): Promise<void> {
    const now = dayjs().toISOString();
    const currentReversal = await this.getReversalById(id);

    await runQuery(
      `UPDATE reversal_records 
       SET status = ?, 
           transaction_id = ?, 
           retry_count = ?, 
           last_retry_at = ?, 
           error_message = ?, 
           updated_at = ?
       WHERE id = ?`,
      [
        status,
        transactionId,
        currentReversal.retryCount + 1,
        now,
        errorMessage,
        now,
        id
      ]
    );
  },

  rowToReversal(row: ReversalRecordRow): ReversalRecord {
    return {
      id: row.id,
      originalTransactionId: row.original_transaction_id,
      transactionId: row.transaction_id,
      reason: row.reason,
      status: row.status as ReversalStatus,
      retryCount: row.retry_count,
      lastRetryAt: row.last_retry_at,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};