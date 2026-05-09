"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepaymentService = void 0;
const helper_1 = require("../database/helper");
class RepaymentService {
    constructor(db, creditService, withdrawalService) {
        this.db = db;
        this.creditService = creditService;
        this.withdrawalService = withdrawalService;
    }
    async repay(groupCreditId, subAccountId, amount, idempotencyKey, withdrawalId) {
        if (!groupCreditId) {
            throw new Error('缺少集团额度ID');
        }
        if (!subAccountId) {
            throw new Error('缺少子账户ID');
        }
        if (!amount || amount <= 0) {
            throw new Error('还款金额必须大于0');
        }
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            throw new Error('缺少幂等键');
        }
        const existingRepayment = await this.getByIdempotencyKey(idempotencyKey);
        if (existingRepayment) {
            if (existingRepayment.status === 'success') {
                return {
                    success: true,
                    repayment: existingRepayment,
                    isDuplicate: true
                };
            }
            if (existingRepayment.status === 'failed') {
                throw new Error(`之前的还款请求已经失败，原因: ${existingRepayment.failureReason || '未知'}`);
            }
        }
        if (withdrawalId) {
            try {
                const withdrawal = await this.withdrawalService.getWithdrawalById(withdrawalId);
                if (withdrawal.status !== 'success') {
                    throw new Error('只能对成功的提款进行还款');
                }
                if (withdrawal.groupCreditId !== groupCreditId) {
                    throw new Error('提款记录不属于该集团');
                }
                if (withdrawal.subAccountId !== subAccountId) {
                    throw new Error('提款记录不属于该子账户');
                }
            }
            catch (e) {
                if (existingRepayment) {
                    const errorMessage = e instanceof Error ? e.message : '未知错误';
                    await this.db.run(`UPDATE repayments SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`, [errorMessage, helper_1.DatabaseHelper.now(), existingRepayment.id]);
                }
                throw e;
            }
        }
        let repaymentId = helper_1.DatabaseHelper.generateId();
        const now = helper_1.DatabaseHelper.now();
        if (existingRepayment) {
            repaymentId = existingRepayment.id;
            await this.db.run(`UPDATE repayments SET status = 'pending', updated_at = ? WHERE id = ?`, [now, repaymentId]);
        }
        else {
            await this.db.run(`INSERT INTO repayments (id, group_credit_id, sub_account_id, withdrawal_id, amount, status, idempotency_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`, [repaymentId, groupCreditId, subAccountId, withdrawalId || null, amount, idempotencyKey, now, now]);
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
                if (amount > subAccount.usedLimit) {
                    throw new Error(`还款金额不能超过子账户已用额度。子账户已用: ${subAccount.usedLimit}, 还款金额: ${amount}`);
                }
                if (amount > groupCredit.usedLimit) {
                    throw new Error(`还款金额不能超过集团已用额度。集团已用: ${groupCredit.usedLimit}, 还款金额: ${amount}`);
                }
                const newUsedLimit = groupCredit.usedLimit - amount;
                const newAvailableLimit = groupCredit.availableLimit + amount;
                await this.db.run(`UPDATE group_credits 
           SET used_limit = ?, available_limit = ?, updated_at = ? 
           WHERE id = ?`, [newUsedLimit, newAvailableLimit, now, groupCreditId]);
                const newSubUsedLimit = subAccount.usedLimit - amount;
                await this.db.run(`UPDATE sub_accounts 
           SET used_limit = ?, updated_at = ? 
           WHERE id = ?`, [newSubUsedLimit, now, subAccountId]);
                await this.db.run(`UPDATE repayments 
           SET status = 'success', updated_at = ? 
           WHERE id = ?`, [now, repaymentId]);
            });
            const finalRepayment = await this.getRepaymentById(repaymentId);
            return {
                success: true,
                repayment: finalRepayment,
                isDuplicate: false
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            await this.db.run(`UPDATE repayments 
         SET status = 'failed', failure_reason = ?, updated_at = ? 
         WHERE id = ?`, [errorMessage, helper_1.DatabaseHelper.now(), repaymentId]);
            throw error;
        }
    }
    async getByIdempotencyKey(idempotencyKey) {
        const row = await this.db.get(`SELECT * FROM repayments WHERE idempotency_key = ?`, [idempotencyKey]);
        return row ? this.mapToRepayment(row) : undefined;
    }
    async getRepaymentById(id) {
        const row = await this.db.get(`SELECT * FROM repayments WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('还款记录不存在');
        }
        return this.mapToRepayment(row);
    }
    async getRepaymentsBySubAccount(subAccountId) {
        const rows = await this.db.all(`SELECT * FROM repayments WHERE sub_account_id = ? ORDER BY created_at DESC`, [subAccountId]);
        return rows.map(row => this.mapToRepayment(row));
    }
    mapToRepayment(row) {
        return {
            id: row.id,
            groupCreditId: row.group_credit_id,
            subAccountId: row.sub_account_id,
            withdrawalId: row.withdrawal_id,
            amount: row.amount,
            status: row.status,
            idempotencyKey: row.idempotency_key,
            failureReason: row.failure_reason,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
exports.RepaymentService = RepaymentService;
