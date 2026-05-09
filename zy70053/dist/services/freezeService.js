"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreezeService = void 0;
const helper_1 = require("../database/helper");
class FreezeService {
    constructor(db, creditService) {
        this.db = db;
        this.creditService = creditService;
    }
    async freeze(groupCreditId, amount, reason, subAccountId) {
        if (!groupCreditId) {
            throw new Error('缺少集团额度ID');
        }
        if (!amount || amount <= 0) {
            throw new Error('冻结金额必须大于0');
        }
        if (!reason || typeof reason !== 'string') {
            throw new Error('缺少冻结原因');
        }
        const now = helper_1.DatabaseHelper.now();
        return this.db.withTransaction(async () => {
            const groupCredit = await this.creditService.getGroupCreditById(groupCreditId);
            if (groupCredit.status !== 'active') {
                throw new Error('集团额度已停用');
            }
            if (amount > groupCredit.availableLimit) {
                throw new Error(`可用额度不足。当前可用: ${groupCredit.availableLimit}, 冻结金额: ${amount}`);
            }
            let subAccount = null;
            if (subAccountId) {
                subAccount = await this.creditService.getSubAccountById(subAccountId);
                if (subAccount.status !== 'active') {
                    throw new Error('子账户已停用');
                }
                if (subAccount.groupCreditId !== groupCreditId) {
                    throw new Error('子账户不属于该集团');
                }
            }
            const newFrozenLimit = groupCredit.frozenLimit + amount;
            const newAvailableLimit = groupCredit.availableLimit - amount;
            await this.db.run(`UPDATE group_credits 
         SET frozen_limit = ?, available_limit = ?, updated_at = ? 
         WHERE id = ?`, [newFrozenLimit, newAvailableLimit, now, groupCreditId]);
            if (subAccount) {
                const newSubFrozenLimit = subAccount.frozenLimit + amount;
                await this.db.run(`UPDATE sub_accounts 
           SET frozen_limit = ?, updated_at = ? 
           WHERE id = ?`, [newSubFrozenLimit, now, subAccountId]);
            }
            const freezeRecordId = helper_1.DatabaseHelper.generateId();
            await this.db.run(`INSERT INTO freeze_records (id, group_credit_id, sub_account_id, amount, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`, [freezeRecordId, groupCreditId, subAccountId || null, amount, reason, now, now]);
            return this.getFreezeRecordById(freezeRecordId);
        });
    }
    async unfreeze(freezeRecordId) {
        if (!freezeRecordId) {
            throw new Error('缺少冻结记录ID');
        }
        const now = helper_1.DatabaseHelper.now();
        return this.db.withTransaction(async () => {
            const freezeRecord = await this.getFreezeRecordById(freezeRecordId);
            if (freezeRecord.status !== 'active') {
                throw new Error('冻结记录已释放或无效');
            }
            const groupCredit = await this.creditService.getGroupCreditById(freezeRecord.groupCreditId);
            const newFrozenLimit = groupCredit.frozenLimit - freezeRecord.amount;
            const newAvailableLimit = groupCredit.availableLimit + freezeRecord.amount;
            await this.db.run(`UPDATE group_credits 
         SET frozen_limit = ?, available_limit = ?, updated_at = ? 
         WHERE id = ?`, [newFrozenLimit, newAvailableLimit, now, freezeRecord.groupCreditId]);
            if (freezeRecord.subAccountId) {
                const subAccount = await this.creditService.getSubAccountById(freezeRecord.subAccountId);
                const newSubFrozenLimit = Math.max(0, subAccount.frozenLimit - freezeRecord.amount);
                await this.db.run(`UPDATE sub_accounts 
           SET frozen_limit = ?, updated_at = ? 
           WHERE id = ?`, [newSubFrozenLimit, now, freezeRecord.subAccountId]);
            }
            await this.db.run(`UPDATE freeze_records 
         SET status = 'released', released_at = ?, updated_at = ? 
         WHERE id = ?`, [now, now, freezeRecordId]);
            return this.getFreezeRecordById(freezeRecordId);
        });
    }
    async getFreezeRecordById(id) {
        const row = await this.db.get(`SELECT * FROM freeze_records WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('冻结记录不存在');
        }
        return this.mapToFreezeRecord(row);
    }
    async getActiveFreezes(groupCreditId, subAccountId) {
        let sql = `SELECT * FROM freeze_records WHERE group_credit_id = ? AND status = 'active'`;
        const params = [groupCreditId];
        if (subAccountId) {
            sql += ` AND sub_account_id = ?`;
            params.push(subAccountId);
        }
        sql += ` ORDER BY created_at DESC`;
        const rows = await this.db.all(sql, params);
        return rows.map(row => this.mapToFreezeRecord(row));
    }
    async getActiveFreezesBySubAccount(subAccountId) {
        const subAccount = await this.creditService.getSubAccountById(subAccountId);
        return this.getActiveFreezes(subAccount.groupCreditId, subAccountId);
    }
    mapToFreezeRecord(row) {
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
exports.FreezeService = FreezeService;
