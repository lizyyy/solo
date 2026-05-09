"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = void 0;
const helper_1 = require("../database/helper");
class CreditService {
    constructor(db) {
        this.db = db;
    }
    async createGroupCredit(name, totalLimit) {
        if (!name || typeof name !== 'string') {
            throw new Error('缺少集团名称');
        }
        if (!totalLimit || totalLimit <= 0 || typeof totalLimit !== 'number') {
            throw new Error('授信额度必须大于0');
        }
        const id = helper_1.DatabaseHelper.generateId();
        const now = helper_1.DatabaseHelper.now();
        await this.db.run(`INSERT INTO group_credits (id, name, total_limit, available_limit, used_limit, frozen_limit, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, 'active', ?, ?)`, [id, name, totalLimit, totalLimit, now, now]);
        return this.getGroupCreditById(id);
    }
    async createSubAccount(groupCreditId, name) {
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
        const id = helper_1.DatabaseHelper.generateId();
        const now = helper_1.DatabaseHelper.now();
        await this.db.run(`INSERT INTO sub_accounts (id, group_credit_id, name, used_limit, frozen_limit, status, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, 'active', ?, ?)`, [id, groupCreditId, name, now, now]);
        return this.getSubAccountById(id);
    }
    async getGroupCreditById(id) {
        const row = await this.db.get(`SELECT * FROM group_credits WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('集团额度不存在');
        }
        return this.mapToGroupCredit(row);
    }
    async getSubAccountById(id) {
        const row = await this.db.get(`SELECT * FROM sub_accounts WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('子账户不存在');
        }
        return this.mapToSubAccount(row);
    }
    async getGroupCreditWithSubAccounts(groupCreditId) {
        const groupCredit = await this.getGroupCreditById(groupCreditId);
        const subAccounts = await this.getSubAccountsByGroup(groupCreditId);
        return { groupCredit, subAccounts };
    }
    async getSubAccountsByGroup(groupCreditId) {
        const rows = await this.db.all(`SELECT * FROM sub_accounts WHERE group_credit_id = ?`, [groupCreditId]);
        return rows.map(row => this.mapToSubAccount(row));
    }
    async adjustGroupLimit(groupCreditId, newTotalLimit) {
        const groupCredit = await this.getGroupCreditById(groupCreditId);
        if (newTotalLimit < 0) {
            throw new Error('授信额度不能为负数');
        }
        const currentTotalUsed = groupCredit.usedLimit + groupCredit.frozenLimit;
        if (newTotalLimit < currentTotalUsed) {
            throw new Error(`新额度不能小于已使用+已冻结额度(${currentTotalUsed})`);
        }
        const newAvailableLimit = newTotalLimit - currentTotalUsed;
        const now = helper_1.DatabaseHelper.now();
        await this.db.run(`UPDATE group_credits 
       SET total_limit = ?, available_limit = ?, updated_at = ? 
       WHERE id = ?`, [newTotalLimit, newAvailableLimit, now, groupCreditId]);
        return this.getGroupCreditById(groupCreditId);
    }
    mapToGroupCredit(row) {
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
    mapToSubAccount(row) {
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
exports.CreditService = CreditService;
