"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollbackService = exports.RollbackService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
class RollbackService {
    async generateRollbackCandidates(recordId) {
        const failedItems = await (0, database_1.allQuery)(`SELECT * FROM init_detail_items WHERE record_id = ? AND status = 'FAILED'`, [recordId]);
        const candidates = [];
        for (const item of failedItems) {
            const candidateId = (0, uuid_1.v4)();
            await (0, database_1.runQuery)(`INSERT INTO rollback_candidates (id, record_id, item_type, item_id, item_name, reason) 
         VALUES (?, ?, ?, ?, ?, ?)`, [candidateId, recordId, item.item_type, item.item_id, item.item_name, item.error_message]);
            candidates.push({
                id: candidateId,
                recordId: recordId,
                itemType: item.item_type,
                itemId: item.item_id,
                itemName: item.item_name,
                reason: item.error_message,
                createdAt: new Date()
            });
        }
        const record = await (0, database_1.getQuery)(`SELECT tenant_id FROM tenant_init_records WHERE id = ?`, [recordId]);
        if (record) {
            const partialDevices = await (0, database_1.allQuery)(`SELECT id, device_code, device_name FROM device_ledgers WHERE tenant_id = ? AND status = '待安装'`, [record.tenant_id]);
            for (const device of partialDevices) {
                const candidateId = (0, uuid_1.v4)();
                await (0, database_1.runQuery)(`INSERT INTO rollback_candidates (id, record_id, item_type, item_id, item_name, reason) 
           VALUES (?, ?, ?, ?, ?, ?)`, [candidateId, recordId, 'DEVICE', device.device_code, device.device_name, '设备未完成安装']);
                candidates.push({
                    id: candidateId,
                    recordId: recordId,
                    itemType: 'DEVICE',
                    itemId: device.device_code,
                    itemName: device.device_name,
                    reason: '设备未完成安装',
                    createdAt: new Date()
                });
            }
        }
        return candidates;
    }
    async getRollbackCandidates(recordId) {
        const rows = await (0, database_1.allQuery)(`SELECT * FROM rollback_candidates WHERE record_id = ? ORDER BY created_at DESC`, [recordId]);
        return rows.map(row => ({
            id: row.id,
            recordId: row.record_id,
            itemType: row.item_type,
            itemId: row.item_id,
            itemName: row.item_name,
            reason: row.reason,
            createdAt: new Date(row.created_at)
        }));
    }
    async clearRollbackCandidates(recordId) {
        await (0, database_1.runQuery)(`DELETE FROM rollback_candidates WHERE record_id = ?`, [recordId]);
    }
    async executeRollback(recordId, candidateIds) {
        const rolledBack = [];
        for (const candidateId of candidateIds) {
            const candidate = await (0, database_1.getQuery)(`SELECT * FROM rollback_candidates WHERE id = ? AND record_id = ?`, [candidateId, recordId]);
            if (!candidate)
                continue;
            if (candidate.item_type === 'DEVICE') {
                const record = await (0, database_1.getQuery)(`SELECT tenant_id FROM tenant_init_records WHERE id = ?`, [recordId]);
                if (record) {
                    await (0, database_1.runQuery)(`DELETE FROM device_ledgers WHERE tenant_id = ? AND device_code = ?`, [record.tenant_id, candidate.item_id]);
                }
            }
            await (0, database_1.runQuery)(`DELETE FROM rollback_candidates WHERE id = ?`, [candidateId]);
            rolledBack.push(candidate.item_id);
        }
        return { success: true, rolledBack };
    }
    async generateCleanupCandidates() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const expiredRecords = await (0, database_1.allQuery)(`SELECT id, tenant_id, tenant_name, created_at, status 
       FROM tenant_init_records 
       WHERE created_at < ? AND status IN ('FAILED', 'PARTIAL_SUCCESS')
       ORDER BY created_at ASC`, [thirtyDaysAgo]);
        return {
            expiredRecords,
            orphanedFiles: [],
            emptyUploads: []
        };
    }
}
exports.RollbackService = RollbackService;
exports.rollbackService = new RollbackService();
