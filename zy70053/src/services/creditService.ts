import { DatabaseHelper } from '../database/helper';
import { GroupCredit, SubAccount } from '../models/types';

export class CreditService {
  private db: DatabaseHelper;

  constructor(db: DatabaseHelper) {
    this.db = db;
  }

  async createGroupCredit(name: string, totalLimit: number): Promise<GroupCredit> {
    if (!name || typeof name !== 'string') {
      throw new Error('缺少集团名称');
    }
    if (!totalLimit || totalLimit <= 0 || typeof totalLimit !== 'number') {
      throw new Error('授信额度必须大于0');
    }

    const id = DatabaseHelper.generateId();
    const now = DatabaseHelper.now();

    await this.db.run(
      `INSERT INTO group_credits (id, name, total_limit, available_limit, used_limit, frozen_limit, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, 'active', ?, ?)`,
      [id, name, totalLimit, totalLimit, now, now]
    );

    return this.getGroupCreditById(id);
  }

  async createSubAccount(groupCreditId: string, name: string): Promise<SubAccount> {
    if (!groupCreditId) {
      throw new Error('缺少集团额度ID');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('缺少子账户名称');
    }

    const groupCredit = await this.getGroupCreditById(groupCreditId);
    if (!groupCredit) {
      throw new Error('集团额度不存在');
    }
    if (groupCredit.status !== 'active') {
      throw new Error('集团额度已停用');
    }

    const id = DatabaseHelper.generateId();
    const now = DatabaseHelper.now();

    await this.db.run(
      `INSERT INTO sub_accounts (id, group_credit_id, name, used_limit, frozen_limit, status, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, 'active', ?, ?)`,
      [id, groupCreditId, name, now, now]
    );

    return this.getSubAccountById(id);
  }

  async getGroupCreditById(id: string): Promise<GroupCredit> {
    const row = await this.db.get<any>(
      `SELECT * FROM group_credits WHERE id = ?`,
      [id]
    );

    if (!row) {
      throw new Error('集团额度不存在');
    }

    return this.mapToGroupCredit(row);
  }

  async getSubAccountById(id: string): Promise<SubAccount> {
    const row = await this.db.get<any>(
      `SELECT * FROM sub_accounts WHERE id = ?`,
      [id]
    );

    if (!row) {
      throw new Error('子账户不存在');
    }

    return this.mapToSubAccount(row);
  }

  async getGroupCreditWithSubAccounts(groupCreditId: string): Promise<{
    groupCredit: GroupCredit;
    subAccounts: SubAccount[];
  }> {
    const groupCredit = await this.getGroupCreditById(groupCreditId);
    const subAccounts = await this.getSubAccountsByGroup(groupCreditId);
    return { groupCredit, subAccounts };
  }

  async getSubAccountsByGroup(groupCreditId: string): Promise<SubAccount[]> {
    const rows = await this.db.all<any>(
      `SELECT * FROM sub_accounts WHERE group_credit_id = ?`,
      [groupCreditId]
    );

    return rows.map(row => this.mapToSubAccount(row));
  }

  async adjustGroupLimit(groupCreditId: string, newTotalLimit: number): Promise<GroupCredit> {
    const groupCredit = await this.getGroupCreditById(groupCreditId);
    
    if (newTotalLimit < 0) {
      throw new Error('授信额度不能为负数');
    }

    const currentTotalUsed = groupCredit.usedLimit + groupCredit.frozenLimit;
    if (newTotalLimit < currentTotalUsed) {
      throw new Error(`新额度不能小于已使用+已冻结额度(${currentTotalUsed})`);
    }

    const newAvailableLimit = newTotalLimit - currentTotalUsed;
    const now = DatabaseHelper.now();

    await this.db.run(
      `UPDATE group_credits 
       SET total_limit = ?, available_limit = ?, updated_at = ? 
       WHERE id = ?`,
      [newTotalLimit, newAvailableLimit, now, groupCreditId]
    );

    return this.getGroupCreditById(groupCreditId);
  }

  private mapToGroupCredit(row: any): GroupCredit {
    return {
      id: row.id,
      name: row.name,
      totalLimit: row.total_limit,
      availableLimit: row.available_limit,
      usedLimit: row.used_limit,
      frozenLimit: row.frozen_limit,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapToSubAccount(row: any): SubAccount {
    return {
      id: row.id,
      groupCreditId: row.group_credit_id,
      name: row.name,
      usedLimit: row.used_limit,
      frozenLimit: row.frozen_limit,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
