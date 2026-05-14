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
        return this.db.withTransaction(async () => {
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
            const groupCreditRow = await this.db.get(`SELECT * FROM group_credits WHERE id = ?`, [groupCreditId]);
            if (!groupCreditRow) {
                throw new Error('集团额度不存在');
            }
            const subAccountRow = await this.db.get(`SELECT * FROM sub_accounts WHERE id = ?`, [subAccountId]);
            if (!subAccountRow) {
                throw new Error('子账户不存在');
            }
            if (groupCreditRow.status !== 'active') {
                throw new Error('集团额度已停用');
            }
            if (subAccountRow.status !== 'active') {
                throw new Error('子账户已停用');
            }
            if (subAccountRow.group_credit_id !== groupCreditId) {
                throw new Error('子账户不属于该集团');
            }
            if (amount > groupCreditRow.available_limit) {
                throw new Error(`可用额度不足。当前可用: ${groupCreditRow.available_limit}, 提款金额: ${amount}`);
            }
            const now = helper_1.DatabaseHelper.now();
            const newUsedLimit = groupCreditRow.used_limit + amount;
            const newAvailableLimit = groupCreditRow.available_limit - amount;
            const newGroupVersion = groupCreditRow.version + 1;
            const newSubUsedLimit = subAccountRow.used_limit + amount;
            const newSubVersion = subAccountRow.version + 1;
            const groupUpdateResult = await this.db.runWithResult(`UPDATE group_credits 
         SET used_limit = ?, available_limit = ?, version = ?, updated_at = ? 
         WHERE id = ? AND version = ?`, [newUsedLimit, newAvailableLimit, newGroupVersion, now, groupCreditId, groupCreditRow.version]);
            if (groupUpdateResult.changes === 0) {
                throw new Error('并发冲突，集团额度已被其他操作修改，请重试');
            }
            const subUpdateResult = await this.db.runWithResult(`UPDATE sub_accounts 
         SET used_limit = ?, version = ?, updated_at = ? 
         WHERE id = ? AND version = ?`, [newSubUsedLimit, newSubVersion, now, subAccountId, subAccountRow.version]);
            if (subUpdateResult.changes === 0) {
                throw new Error('并发冲突，子账户额度已被其他操作修改，请重试');
            }
            let withdrawalId;
            if (existingWithdrawal) {
                withdrawalId = existingWithdrawal.id;
                await this.db.run(`UPDATE withdrawals 
           SET status = 'success', updated_at = ? 
           WHERE id = ?`, [now, withdrawalId]);
            }
            else {
                withdrawalId = helper_1.DatabaseHelper.generateId();
                await this.db.run(`INSERT INTO withdrawals (id, group_credit_id, sub_account_id, amount, status, idempotency_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'success', ?, ?, ?)`, [withdrawalId, groupCreditId, subAccountId, amount, idempotencyKey, now, now]);
            }
            const finalWithdrawal = await this.getWithdrawalById(withdrawalId);
            return {
                success: true,
                withdrawal: finalWithdrawal,
                isDuplicate: false
            };
        }).catch(async (error) => {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            const existingWithdrawal = await this.getByIdempotencyKey(idempotencyKey);
            if (existingWithdrawal && existingWithdrawal.status === 'pending') {
                await this.db.run(`UPDATE withdrawals 
           SET status = 'failed', failure_reason = ?, updated_at = ? 
           WHERE id = ?`, [errorMessage, helper_1.DatabaseHelper.now(), existingWithdrawal.id]);
            }
            throw error;
        });
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
