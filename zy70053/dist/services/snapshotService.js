"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotService = void 0;
const helper_1 = require("../database/helper");
class SnapshotService {
    constructor(db, creditService) {
        this.db = db;
        this.creditService = creditService;
    }
    async createSnapshot(groupCreditId, snapshotTime) {
        const now = snapshotTime || new Date();
        const nowStr = now.toISOString();
        return this.db.withTransaction(async () => {
            const { groupCredit, subAccounts } = await this.creditService.getGroupCreditWithSubAccounts(groupCreditId);
            const subAccountSnapshots = subAccounts.map(sa => ({
                subAccountId: sa.id,
                name: sa.name,
                usedLimit: sa.usedLimit,
                frozenLimit: sa.frozenLimit
            }));
            const snapshotId = helper_1.DatabaseHelper.generateId();
            await this.db.run(`INSERT INTO balance_snapshots (id, group_credit_id, snapshot_time, total_limit, available_limit, used_limit, frozen_limit, sub_accounts_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                snapshotId,
                groupCreditId,
                nowStr,
                groupCredit.totalLimit,
                groupCredit.availableLimit,
                groupCredit.usedLimit,
                groupCredit.frozenLimit,
                JSON.stringify(subAccountSnapshots),
                helper_1.DatabaseHelper.now()
            ]);
            return this.getSnapshotById(snapshotId);
        });
    }
    async getSnapshotById(id) {
        const row = await this.db.get(`SELECT * FROM balance_snapshots WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('快照不存在');
        }
        return this.mapToBalanceSnapshot(row);
    }
    async getLatestSnapshot(groupCreditId) {
        const rows = await this.db.all(`SELECT * FROM balance_snapshots 
       WHERE group_credit_id = ? 
       ORDER BY snapshot_time DESC 
       LIMIT 1`, [groupCreditId]);
        return rows.length > 0 ? this.mapToBalanceSnapshot(rows[0]) : undefined;
    }
    async getSnapshotsByGroup(groupCreditId, startTime, endTime, limit = 100) {
        let sql = `SELECT * FROM balance_snapshots WHERE group_credit_id = ?`;
        const params = [groupCreditId];
        if (startTime) {
            sql += ` AND snapshot_time >= ?`;
            params.push(startTime.toISOString());
        }
        if (endTime) {
            sql += ` AND snapshot_time <= ?`;
            params.push(endTime.toISOString());
        }
        sql += ` ORDER BY snapshot_time DESC LIMIT ?`;
        params.push(limit);
        const rows = await this.db.all(sql, params);
        return rows.map(row => this.mapToBalanceSnapshot(row));
    }
    async validateSnapshot(snapshotId) {
        const snapshot = await this.getSnapshotById(snapshotId);
        const { groupCredit, subAccounts } = await this.creditService.getGroupCreditWithSubAccounts(snapshot.groupCreditId);
        const differences = [];
        if (snapshot.totalLimit !== groupCredit.totalLimit) {
            differences.push(`总额度不一致: 快照${snapshot.totalLimit} vs 当前${groupCredit.totalLimit}`);
        }
        if (snapshot.availableLimit !== groupCredit.availableLimit) {
            differences.push(`可用额度不一致: 快照${snapshot.availableLimit} vs 当前${groupCredit.availableLimit}`);
        }
        if (snapshot.usedLimit !== groupCredit.usedLimit) {
            differences.push(`已用额度不一致: 快照${snapshot.usedLimit} vs 当前${groupCredit.usedLimit}`);
        }
        if (snapshot.frozenLimit !== groupCredit.frozenLimit) {
            differences.push(`冻结额度不一致: 快照${snapshot.frozenLimit} vs 当前${groupCredit.frozenLimit}`);
        }
        for (const saSnapshot of snapshot.subAccounts) {
            const currentSA = subAccounts.find(sa => sa.id === saSnapshot.subAccountId);
            if (currentSA) {
                if (saSnapshot.usedLimit !== currentSA.usedLimit) {
                    differences.push(`子账户${saSnapshot.name}已用额度不一致: 快照${saSnapshot.usedLimit} vs 当前${currentSA.usedLimit}`);
                }
                if (saSnapshot.frozenLimit !== currentSA.frozenLimit) {
                    differences.push(`子账户${saSnapshot.name}冻结额度不一致: 快照${saSnapshot.frozenLimit} vs 当前${currentSA.frozenLimit}`);
                }
            }
            else {
                differences.push(`子账户${saSnapshot.name}在快照中存在但当前已不存在`);
            }
        }
        return {
            valid: differences.length === 0,
            differences
        };
    }
    async verifyConsistency(groupCreditId) {
        const { groupCredit, subAccounts } = await this.creditService.getGroupCreditWithSubAccounts(groupCreditId);
        const issues = [];
        const totalUsed = subAccounts.reduce((sum, sa) => sum + sa.usedLimit, 0);
        const totalFrozen = subAccounts.reduce((sum, sa) => sum + sa.frozenLimit, 0);
        if (Math.abs(totalUsed - groupCredit.usedLimit) > 0.01) {
            issues.push(`子账户已用额度总和(${totalUsed})与集团已用额度(${groupCredit.usedLimit})不一致`);
        }
        if (Math.abs(totalFrozen - groupCredit.frozenLimit) > 0.01) {
            issues.push(`子账户冻结额度总和(${totalFrozen})与集团冻结额度(${groupCredit.frozenLimit})不一致`);
        }
        const calculatedTotal = groupCredit.usedLimit + groupCredit.frozenLimit + groupCredit.availableLimit;
        if (Math.abs(calculatedTotal - groupCredit.totalLimit) > 0.01) {
            issues.push(`已用+冻结+可用(${calculatedTotal})与总额度(${groupCredit.totalLimit})不一致`);
        }
        return {
            consistent: issues.length === 0,
            issues
        };
    }
    mapToBalanceSnapshot(row) {
        return {
            id: row.id,
            groupCreditId: row.group_credit_id,
            snapshotTime: new Date(row.snapshot_time),
            totalLimit: row.total_limit,
            availableLimit: row.available_limit,
            usedLimit: row.used_limit,
            frozenLimit: row.frozen_limit,
            subAccounts: JSON.parse(row.sub_accounts_json),
            createdAt: new Date(row.created_at)
        };
    }
}
exports.SnapshotService = SnapshotService;
