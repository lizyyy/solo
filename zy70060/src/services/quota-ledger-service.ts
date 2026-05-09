import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, getAll, beginTransaction, commitTransaction, rollbackTransaction } from '../utils/db-helpers';
import { QuotaLedger } from '../types';

const ANNUAL_QUOTA = 50000;

interface QuotaLedgerRow {
  id: string;
  customer_id: string;
  year: number;
  total_quota: number;
  used_quota: number;
  available_quota: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export const quotaLedgerService = {
  async getOrCreateLedger(customerId: string, year?: number): Promise<QuotaLedger> {
    const targetYear = year || dayjs().year();
    
    const existing = await getOne<QuotaLedgerRow>(
      'SELECT * FROM quota_ledgers WHERE customer_id = ? AND year = ?',
      [customerId, targetYear]
    );

    if (existing) {
      return this.rowToLedger(existing);
    }

    return this.createLedger(customerId, targetYear);
  },

  async createLedger(customerId: string, year: number): Promise<QuotaLedger> {
    const id = uuidv4();
    const now = dayjs().toISOString();

    await runQuery(
      `INSERT INTO quota_ledgers (
        id, customer_id, year, total_quota, used_quota, 
        available_quota, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, customerId, year, ANNUAL_QUOTA, 0, ANNUAL_QUOTA, 0, now, now]
    );

    return {
      id,
      customerId,
      year,
      totalQuota: ANNUAL_QUOTA,
      usedQuota: 0,
      availableQuota: ANNUAL_QUOTA,
      version: 0,
      createdAt: now,
      updatedAt: now
    };
  },

  async occupyQuota(
    customerId: string,
    amount: number,
    year?: number
  ): Promise<QuotaLedger> {
    const targetYear = year || dayjs().year();
    
    const ledger = await this.getOrCreateLedger(customerId, targetYear);
    
    if (ledger.availableQuota < amount) {
      throw new Error(`额度不足。可用额度: ${ledger.availableQuota}, 申请金额: ${amount}`);
    }

    const now = dayjs().toISOString();
    const newUsedQuota = ledger.usedQuota + amount;
    const newAvailableQuota = ledger.availableQuota - amount;
    const newVersion = ledger.version + 1;

    const result = await runQuery(
      `UPDATE quota_ledgers 
       SET used_quota = ?, available_quota = ?, version = ?, updated_at = ?
       WHERE id = ? AND version = ?`,
      [newUsedQuota, newAvailableQuota, newVersion, now, ledger.id, ledger.version]
    );

    if (result.changes === 0) {
      return this.occupyQuota(customerId, amount, year);
    }

    return {
      ...ledger,
      usedQuota: newUsedQuota,
      availableQuota: newAvailableQuota,
      version: newVersion,
      updatedAt: now
    };
  },

  async releaseQuota(
    customerId: string,
    amount: number,
    year?: number
  ): Promise<QuotaLedger> {
    const targetYear = year || dayjs().year();
    
    const ledger = await this.getOrCreateLedger(customerId, targetYear);
    
    if (ledger.usedQuota < amount) {
      throw new Error(`释放金额超过已使用额度。已使用: ${ledger.usedQuota}, 释放金额: ${amount}`);
    }

    const now = dayjs().toISOString();
    const newUsedQuota = ledger.usedQuota - amount;
    const newAvailableQuota = ledger.availableQuota + amount;
    const newVersion = ledger.version + 1;

    const result = await runQuery(
      `UPDATE quota_ledgers 
       SET used_quota = ?, available_quota = ?, version = ?, updated_at = ?
       WHERE id = ? AND version = ?`,
      [newUsedQuota, newAvailableQuota, newVersion, now, ledger.id, ledger.version]
    );

    if (result.changes === 0) {
      return this.releaseQuota(customerId, amount, year);
    }

    return {
      ...ledger,
      usedQuota: newUsedQuota,
      availableQuota: newAvailableQuota,
      version: newVersion,
      updatedAt: now
    };
  },

  async getLedger(customerId: string, year?: number): Promise<QuotaLedger | undefined> {
    const targetYear = year || dayjs().year();
    
    const row = await getOne<QuotaLedgerRow>(
      'SELECT * FROM quota_ledgers WHERE customer_id = ? AND year = ?',
      [customerId, targetYear]
    );

    return row ? this.rowToLedger(row) : undefined;
  },

  async getAllLedgers(customerId: string): Promise<QuotaLedger[]> {
    const rows = await getAll<QuotaLedgerRow>(
      'SELECT * FROM quota_ledgers WHERE customer_id = ? ORDER BY year DESC',
      [customerId]
    );

    return rows.map(this.rowToLedger);
  },

  async recalculateQuota(customerId: string, year: number): Promise<QuotaLedger> {
    await beginTransaction();

    try {
      const transactionRows = await getAll<{ type: string; rmb_amount: number }>(
        `SELECT type, rmb_amount 
         FROM transactions 
         WHERE customer_id = ? 
         AND strftime('%Y', created_at) = ? 
         AND status = 'SUCCESS'`,
        [customerId, year.toString()]
      );

      let usedQuota = 0;
      for (const row of transactionRows) {
        usedQuota += row.rmb_amount;
      }

      const availableQuota = ANNUAL_QUOTA - usedQuota;
      const now = dayjs().toISOString();

      const result = await runQuery(
        `UPDATE quota_ledgers 
         SET used_quota = ?, available_quota = ?, version = version + 1, updated_at = ?
         WHERE customer_id = ? AND year = ?`,
        [usedQuota, availableQuota, now, customerId, year]
      );

      if (result.changes === 0) {
        await this.createLedger(customerId, year);
        await commitTransaction();
        return this.getOrCreateLedger(customerId, year);
      }

      await commitTransaction();
      return this.getOrCreateLedger(customerId, year);
    } catch (error) {
      await rollbackTransaction();
      throw error;
    }
  },

  rowToLedger(row: QuotaLedgerRow): QuotaLedger {
    return {
      id: row.id,
      customerId: row.customer_id,
      year: row.year,
      totalQuota: row.total_quota,
      usedQuota: row.used_quota,
      availableQuota: row.available_quota,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};