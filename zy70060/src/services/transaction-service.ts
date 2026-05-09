import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, getAll, beginTransaction, commitTransaction, rollbackTransaction } from '../utils/db-helpers';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { quotaLedgerService } from './quota-ledger-service';
import { exchangeRateService } from './exchange-rate-service';
import { idempotentService } from './idempotent-service';
import { failedOperationService } from './failed-operation-service';

interface TransactionRow {
  id: string;
  idempotent_key: string;
  customer_id: string;
  type: string;
  currency: string;
  foreign_currency_amount: number;
  rmb_amount: number;
  rate_snapshot_id: string;
  quota_ledger_id: string;
  status: string;
  remark: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionRequest {
  idempotentKey: string;
  customerId: string;
  type: TransactionType;
  currency: string;
  foreignCurrencyAmount: number;
  remark?: string;
}

export const transactionService = {
  async createTransaction(request: CreateTransactionRequest): Promise<Transaction> {
    return idempotentService.withIdempotent(
      request.idempotentKey,
      async () => {
        await beginTransaction();

        try {
          const rateSnapshot = await exchangeRateService.getLatestSnapshot(request.currency);
          if (!rateSnapshot) {
            throw new Error(`未找到 ${request.currency} 的汇率快照`);
          }

          const rate = request.type === 'BUY' ? rateSnapshot.sellRate : rateSnapshot.buyRate;
          const rmbAmount = request.foreignCurrencyAmount * rate;

          const year = dayjs().year();
          const ledger = await quotaLedgerService.getOrCreateLedger(request.customerId, year);

          const updatedLedger = await quotaLedgerService.occupyQuota(
            request.customerId,
            rmbAmount,
            year
          );

          const transactionId = uuidv4();
          const now = dayjs().toISOString();

          await runQuery(
            `INSERT INTO transactions (
              id, idempotent_key, customer_id, type, currency, 
              foreign_currency_amount, rmb_amount, rate_snapshot_id, 
              quota_ledger_id, status, remark, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              transactionId,
              request.idempotentKey,
              request.customerId,
              request.type,
              request.currency,
              request.foreignCurrencyAmount,
              rmbAmount,
              rateSnapshot.id,
              updatedLedger.id,
              'SUCCESS',
              request.remark || '',
              now,
              now
            ]
          );

          await commitTransaction();

          return this.getTransactionById(transactionId);
        } catch (error) {
          await rollbackTransaction();
          await failedOperationService.createOperation(
            'CREATE_TRANSACTION',
            JSON.stringify(request),
            error instanceof Error ? error.message : '未知错误'
          );
          throw error;
        }
      }
    ).then(result => result.result as Transaction);
  },

  async getTransactionById(id: string): Promise<Transaction> {
    const row = await getOne<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );

    if (!row) {
      throw new Error(`交易不存在: ${id}`);
    }

    return this.rowToTransaction(row);
  },

  async getTransactionByIdempotentKey(idempotentKey: string): Promise<Transaction | undefined> {
    const row = await getOne<TransactionRow>(
      'SELECT * FROM transactions WHERE idempotent_key = ?',
      [idempotentKey]
    );

    return row ? this.rowToTransaction(row) : undefined;
  },

  async getCustomerTransactions(customerId: string, limit: number = 100): Promise<Transaction[]> {
    const rows = await getAll<TransactionRow>(
      `SELECT * FROM transactions 
       WHERE customer_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [customerId, limit]
    );

    return rows.map(this.rowToTransaction);
  },

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    const now = dayjs().toISOString();

    await runQuery(
      'UPDATE transactions SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );

    return this.getTransactionById(id);
  },

  async cancelTransaction(id: string): Promise<Transaction> {
    const transaction = await this.getTransactionById(id);

    if (transaction.status !== 'SUCCESS' && transaction.status !== 'PENDING') {
      throw new Error(`无法取消当前状态的交易: ${transaction.status}`);
    }

    await beginTransaction();

    try {
      const year = dayjs(transaction.createdAt).year();
      await quotaLedgerService.releaseQuota(
        transaction.customerId,
        transaction.rmbAmount,
        year
      );

      await this.updateTransactionStatus(id, 'CANCELLED');

      await commitTransaction();
      return this.getTransactionById(id);
    } catch (error) {
      await rollbackTransaction();
      throw error;
    }
  },

  rowToTransaction(row: TransactionRow): Transaction {
    return {
      id: row.id,
      idempotentKey: row.idempotent_key,
      customerId: row.customer_id,
      type: row.type as TransactionType,
      currency: row.currency,
      foreignCurrencyAmount: row.foreign_currency_amount,
      rmbAmount: row.rmb_amount,
      rateSnapshotId: row.rate_snapshot_id,
      quotaLedgerId: row.quota_ledger_id,
      status: row.status as TransactionStatus,
      remark: row.remark,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};