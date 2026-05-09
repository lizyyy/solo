"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalService = void 0;
const helper_1 = require("../database/helper");
class WithdrawalService {
    constructor(db, creditService) {
        this.db = db;
        this.creditService = creditService;
    }
    async withdraw(groupCreditId, subAccountId, amount, idempotencyKey) {
        if (!groupCreditId) {
            throw new Error('缺少集团额度ID');
        }
        if (!subAccountId) {
            throw new Error('缺少子账户ID');
        }
        if (!amount || amount <= 0) {
            throw new Error('提款金额必须大于0');
        }
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            throw new Error('缺少幂等键');
        }
        const existingWithdrawal = await this.getByIdempotencyKey(idempotencyKey);
        if (existingWithdrawal) {
            if (existingWithdrawal.status === 'success') {
                return {
                    success: true,
                    withdrawal: existingWithdrawal,
                    isDuplicate: true
                };
            }
            if (existingWithdrawal.status === 'failed') {
                throw new Error(`之前的提款请求已经失败，原因: ${existingWithdrawal.failureReason || '未知'}`);
            }
        }
        let withdrawalId = helper_1.DatabaseHelper.generateId();
        const now = helper_1.DatabaseHelper.now();
        if (existingWithdrawal) {
            withdrawalId = existingWithdrawal.id;
            await this.db.run(`UPDATE withdrawals SET status = 'pending', updated_at = ? WHERE id = ?`, [now, withdrawalId]);
        }
        else {
            await this.db.run(`INSERT INTO withdrawals (id, group_credit_id, sub_account_id, amount, status, idempotency_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`, [withdrawalId, groupCreditId, subAccountId, amount, idempotencyKey, now, now]);
        }
        try {
            await this.db.withTransaction(async () => {
                const groupCredit = await this.creditService.getGroupCreditById(groupCreditId);
                const subAccount = await this.creditService.getSubAccountById(subAccountId);
                if (groupCredit.status !== 'active') {
                    throw new Error('集团额度已停用');
                }
                if (subAccount.status !== 'active') {
                    throw new Error('子账户已停用');
                }
                if (subAccount.groupCreditId !== groupCreditId) {
                    throw new Error('子账户不属于该集团');
                }
                if (amount > groupCredit.availableLimit) {
                    throw new Error(`可用额度不足。当前可用: ${groupCredit.availableLimit}, 提款金额: ${amount}`);
                }
                const newUsedLimit = groupCredit.usedLimit + amount;
                const newAvailableLimit = groupCredit.availableLimit - amount;
                await this.db.run(`UPDATE group_credits 
           SET used_limit = ?, available_limit = ?, updated_at = ? 
           WHERE id = ?`, [newUsedLimit, newAvailableLimit, now, groupCreditId]);
                const newSubUsedLimit = subAccount.usedLimit + amount;
                await this.db.run(`UPDATE sub_accounts 
           SET used_limit = ?, updated_at = ? 
           WHERE id = ?`, [newSubUsedLimit, now, subAccountId]);
                await this.db.run(`UPDATE withdrawals 
           SET status = 'success', updated_at = ? 
           WHERE id = ?`, [now, withdrawalId]);
            });
            const finalWithdrawal = await this.getWithdrawalById(withdrawalId);
            return {
                success: true,
                withdrawal: finalWithdrawal,
                isDuplicate: false
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            await this.db.run(`UPDATE withdrawals 
         SET status = 'failed', failure_reason = ?, updated_at = ? 
         WHERE id = ?`, [errorMessage, helper_1.DatabaseHelper.now(), withdrawalId]);
            throw error;
        }
    }
    async getByIdempotencyKey(idempotencyKey) {
        const row = await this.db.get(`SELECT * FROM withdrawals WHERE idempotency_key = ?`, [idempotencyKey]);
        return row ? this.mapToWithdrawal(row) : undefined;
    }
    async getWithdrawalById(id) {
        const row = await this.db.get(`SELECT * FROM withdrawals WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('提款记录不存在');
        }
        return this.mapToWithdrawal(row);
    }
    async getWithdrawalsBySubAccount(subAccountId) {
        const rows = await this.db.all(`SELECT * FROM withdrawals WHERE sub_account_id = ? ORDER BY created_at DESC`, [subAccountId]);
        return rows.map(row => this.mapToWithdrawal(row));
    }
    mapToWithdrawal(row) {
        return {
            id: row.id,
            groupCreditId: row.group_credit_id,
            subAccountId: row.sub_account_id,
            amount: row.amount,
            status: row.status,
            idempotencyKey: row.idempotency_key,
            failureReason: row.failure_reason,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
exports.WithdrawalService = WithdrawalService;
