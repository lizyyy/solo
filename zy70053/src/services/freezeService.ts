import { DatabaseHelper } from '../database/helper';
import { FreezeRecord } from '../models/types';
import { CreditService } from './creditService';

export class FreezeService {
  private db: DatabaseHelper;
  private creditService: CreditService;

  constructor(db: DatabaseHelper, creditService: CreditService) {
    this.db = db;
    this.creditService = creditService;
  }

  async freeze(
    groupCreditId: string,
    amount: number,
    reason: string,
    subAccountId?: string
  ): Promise<FreezeRecord> {
    if (!groupCreditId) {
      throw new Error('缺少集团额度ID');
    }
    if (!amount || amount <= 0) {
      throw new Error('冻结金额必须大于0');
    }
    if (!reason || typeof reason !== 'string') {
      throw new Error('缺少冻结原因');
    }

    const now = DatabaseHelper.now();

    return this.db.withTransaction(async () => {
      const groupCreditRow = await this.db.get<any>(
        `SELECT * FROM group_credits WHERE id = ?`,
        [groupCreditId]
      );
      if (!groupCreditRow) {
        throw new Error('集团额度不存在');
      }

      if (groupCreditRow.status !== 'active') {
        throw new Error('集团额度已停用');
      }

      if (amount > groupCreditRow.available_limit) {
        throw new Error(`可用额度不足。当前可用: ${groupCreditRow.available_limit}, 冻结金额: ${amount}`);
      }

      let subAccountRow: any | null = null;
      if (subAccountId) {
        subAccountRow = await this.db.get<any>(
          `SELECT * FROM sub_accounts WHERE id = ?`,
          [subAccountId]
        );
        if (!subAccountRow) {
          throw new Error('子账户不存在');
        }
        if (subAccountRow.status !== 'active') {
          throw new Error('子账户已停用');
        }
        if (subAccountRow.group_credit_id !== groupCreditId) {
          throw new Error('子账户不属于该集团');
        }
      }

      const newFrozenLimit = groupCreditRow.frozen_limit + amount;
      const newAvailableLimit = groupCreditRow.available_limit - amount;
      const newGroupVersion = groupCreditRow.version + 1;

      const groupUpdateResult = await this.db.runWithResult(
        `UPDATE group_credits 
         SET frozen_limit = ?, available_limit = ?, version = ?, updated_at = ? 
         WHERE id = ? AND version = ?`,
        [newFrozenLimit, newAvailableLimit, newGroupVersion, now, groupCreditId, groupCreditRow.version]
      );

      if (groupUpdateResult.changes === 0) {
        throw new Error('并发冲突，集团额度已被其他操作修改，请重试');
      }

      if (subAccountRow) {
        const newSubFrozenLimit = subAccountRow.frozen_limit + amount;
        const newSubVersion = subAccountRow.version + 1;
        const subUpdateResult = await this.db.runWithResult(
          `UPDATE sub_accounts 
           SET frozen_limit = ?, version = ?, updated_at = ? 
           WHERE id = ? AND version = ?`,
          [newSubFrozenLimit, newSubVersion, now, subAccountId, subAccountRow.version]
        );

        if (subUpdateResult.changes === 0) {
          throw new Error('并发冲突，子账户额度已被其他操作修改，请重试');
        }
      }

      const freezeRecordId = DatabaseHelper.generateId();
      await this.db.run(
        `INSERT INTO freeze_records (id, group_credit_id, sub_account_id, amount, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
        [freezeRecordId, groupCreditId, subAccountId || null, amount, reason, now, now]
      );

      return this.getFreezeRecordById(freezeRecordId);
    });
  }

  async unfreeze(freezeRecordId: string): Promise<FreezeRecord> {
    if (!freezeRecordId) {
      throw new Error('缺少冻结记录ID');
    }

    const now = DatabaseHelper.now();

    return this.db.withTransaction(async () => {
      const freezeRecord = await this.getFreezeRecordById(freezeRecordId);

      if (freezeRecord.status !== 'active') {
        throw new Error('冻结记录已释放或无效');
      }

      const groupCreditRow = await this.db.get<any>(
        `SELECT * FROM group_credits WHERE id = ?`,
        [freezeRecord.groupCreditId]
      );
      if (!groupCreditRow) {
        throw new Error('集团额度不存在');
      }

      const newFrozenLimit = groupCreditRow.frozen_limit - freezeRecord.amount;
      const newAvailableLimit = groupCreditRow.available_limit + freezeRecord.amount;
      const newGroupVersion = groupCreditRow.version + 1;

      const groupUpdateResult = await this.db.runWithResult(
        `UPDATE group_credits 
         SET frozen_limit = ?, available_limit = ?, version = ?, updated_at = ? 
         WHERE id = ? AND version = ?`,
        [newFrozenLimit, newAvailableLimit, newGroupVersion, now, freezeRecord.groupCreditId, groupCreditRow.version]
      );

      if (groupUpdateResult.changes === 0) {
        throw new Error('并发冲突，集团额度已被其他操作修改，请重试');
      }

      if (freezeRecord.subAccountId) {
        const subAccountRow = await this.db.get<any>(
          `SELECT * FROM sub_accounts WHERE id = ?`,
          [freezeRecord.subAccountId]
        );
        if (subAccountRow) {
          const newSubFrozenLimit = Math.max(0, subAccountRow.frozen_limit - freezeRecord.amount);
          const newSubVersion = subAccountRow.version + 1;
          const subUpdateResult = await this.db.runWithResult(
            `UPDATE sub_accounts 
             SET frozen_limit = ?, version = ?, updated_at = ? 
             WHERE id = ? AND version = ?`,
            [newSubFrozenLimit, newSubVersion, now, freezeRecord.subAccountId, subAccountRow.version]
          );

          if (subUpdateResult.changes === 0) {
            throw new Error('并发冲突，子账户额度已被其他操作修改，请重试');
          }
        }
      }

      await this.db.run(
        `UPDATE freeze_records 
         SET status = 'released', released_at = ?, updated_at = ? 
         WHERE id = ?`,
        [now, now, freezeRecordId]
      );

      return this.getFreezeRecordById(freezeRecordId);
    });
  }

  async getFreezeRecordById(id: string): Promise<FreezeRecord> {
    const row = await this.db.get<any>(
      `SELECT * FROM freeze_records WHERE id = ?`,
      [id]
    );
    if (!row) {
      throw new Error('冻结记录不存在');
    }
    return this.mapToFreezeRecord(row);
  }

  async getActiveFreezes(groupCreditId: string, subAccountId?: string): Promise<FreezeRecord[]> {
    let sql = `SELECT * FROM freeze_records WHERE group_credit_id = ? AND status = 'active'`;
    const params: any[] = [groupCreditId];

    if (subAccountId) {
      sql += ` AND sub_account_id = ?`;
      params.push(subAccountId);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = await this.db.all<any>(sql, params);
    return rows.map(row => this.mapToFreezeRecord(row));
  }

  async getActiveFreezesBySubAccount(subAccountId: string): Promise<FreezeRecord[]> {
    const subAccount = await this.creditService.getSubAccountById(subAccountId);
    return this.getActiveFreezes(subAccount.groupCreditId, subAccountId);
  }

  private mapToFreezeRecord(row: any): FreezeRecord {
    return {
      id: row.id,
      groupCreditId: row.group_credit_id,
      subAccountId: row.sub_account_id,
      amount: row.amount,
      reason: row.reason,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      releasedAt: row.released_at ? new Date(row.released_at) : undefined
    };
  }
}
