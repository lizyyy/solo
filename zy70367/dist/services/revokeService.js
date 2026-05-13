"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeService = void 0;
const types_1 = require("../types");
const memoryStore_1 = require("../store/memoryStore");
class RevokeService {
    constructor() {
        this.processingBatches = new Set();
        this.processingRecords = new Set();
    }
    static getInstance() {
        if (!RevokeService.instance) {
            RevokeService.instance = new RevokeService();
        }
        return RevokeService.instance;
    }
    canRevokeRecord(record) {
        if (record.status === types_1.RecordStatus.REVOKED) {
            return { canRevoke: true, reason: '已撤销，但再次撤销为幂等操作' };
        }
        if (record.status === types_1.RecordStatus.REVOKE_FAILED) {
            return { canRevoke: true, reason: '之前撤销失败，可重试' };
        }
        if (record.status === types_1.RecordStatus.NOT_REVOCABLE) {
            return { canRevoke: false, reason: '此记录标记为不可撤销' };
        }
        if (record.status === types_1.RecordStatus.SKIPPED || record.status === types_1.RecordStatus.FAILED) {
            return { canRevoke: true, reason: '记录未成功导入，撤销不会产生实际影响' };
        }
        if (record.isPreExisting) {
            if (record.status === types_1.RecordStatus.UPDATED) {
                return { canRevoke: true, reason: '对已存在用户的更新操作可回滚' };
            }
            if (record.status === types_1.RecordStatus.CREATED) {
                return { canRevoke: false, reason: '已存在用户标记为CREATED，逻辑矛盾' };
            }
        }
        if (record.status === types_1.RecordStatus.CREATED) {
            return { canRevoke: true, reason: '新创建的用户可以被删除' };
        }
        if (record.status === types_1.RecordStatus.UPDATED) {
            return { canRevoke: true, reason: '已更新的用户可以尝试恢复' };
        }
        return { canRevoke: false, reason: `不支持撤销状态: ${record.status}` };
    }
    executeRevokeForRecord(record, batchId) {
        const now = Date.now();
        const compensations = [];
        if (record.status === types_1.RecordStatus.REVOKED) {
            return { status: 'already_revoked', message: '已撤销，幂等处理', compensations };
        }
        if (record.status === types_1.RecordStatus.PENDING || record.status === types_1.RecordStatus.REVOKING) {
            return { status: 'failed', message: '记录处于处理中状态', compensations };
        }
        if (record.status === types_1.RecordStatus.SKIPPED || record.status === types_1.RecordStatus.FAILED) {
            record.status = types_1.RecordStatus.REVOKED;
            record.updatedAt = now;
            memoryStore_1.store.updateRecord(record);
            return { status: 'revoked', message: '记录未成功导入，无实际影响', compensations };
        }
        if (record.isPreExisting && record.status === types_1.RecordStatus.CREATED) {
            record.status = types_1.RecordStatus.NOT_REVOCABLE;
            record.revokeErrorMessage = '导入前已存在的用户不能被删除';
            record.updatedAt = now;
            memoryStore_1.store.updateRecord(record);
            return { status: 'not_revocable', message: '导入前已存在的用户不能被删除', compensations };
        }
        if (record.isPreExisting && record.status === types_1.RecordStatus.UPDATED) {
            const user = memoryStore_1.store.findUserByEmail(record.email);
            if (user) {
                const originalRoleIds = memoryStore_1.store.getUserOriginalRoleIds(user.id);
                if (originalRoleIds) {
                    user.roleIds = originalRoleIds;
                    user.updatedAt = now;
                    memoryStore_1.store.updateUser(user);
                    compensations.push({
                        userId: user.id,
                        action: 'restore_roles',
                        success: true
                    });
                    record.status = types_1.RecordStatus.REVOKED;
                    record.updatedAt = now;
                    memoryStore_1.store.updateRecord(record);
                    return { status: 'revoked', message: '已恢复原角色', compensations };
                }
                else {
                    record.status = types_1.RecordStatus.REVOKE_FAILED;
                    record.revokeErrorMessage = '无法找到原角色信息进行补偿';
                    record.updatedAt = now;
                    memoryStore_1.store.updateRecord(record);
                    compensations.push({
                        userId: user.id,
                        action: 'restore_roles',
                        success: false,
                        errorMessage: '无法找到原角色信息'
                    });
                    return { status: 'failed', message: '无法找到原角色信息进行补偿', compensations };
                }
            }
            else {
                record.status = types_1.RecordStatus.REVOKE_FAILED;
                record.revokeErrorMessage = '用户不存在，无法恢复';
                record.updatedAt = now;
                memoryStore_1.store.updateRecord(record);
                return { status: 'failed', message: '用户不存在，无法恢复', compensations };
            }
        }
        if (!record.isPreExisting && record.status === types_1.RecordStatus.CREATED) {
            const user = memoryStore_1.store.findUserByEmail(record.email);
            if (user) {
                const deleted = memoryStore_1.store.deleteUser(user.id);
                if (deleted) {
                    record.status = types_1.RecordStatus.REVOKED;
                    record.updatedAt = now;
                    memoryStore_1.store.updateRecord(record);
                    compensations.push({
                        userId: user.id,
                        action: 'delete_user',
                        success: true
                    });
                    return { status: 'revoked', message: '新创建的用户已删除', compensations };
                }
                else {
                    record.status = types_1.RecordStatus.REVOKE_FAILED;
                    record.revokeErrorMessage = '删除用户失败';
                    record.updatedAt = now;
                    memoryStore_1.store.updateRecord(record);
                    compensations.push({
                        userId: user.id,
                        action: 'delete_user',
                        success: false,
                        errorMessage: '删除用户失败'
                    });
                    return { status: 'failed', message: '删除用户失败', compensations };
                }
            }
            else {
                record.status = types_1.RecordStatus.REVOKED;
                record.updatedAt = now;
                memoryStore_1.store.updateRecord(record);
                return { status: 'already_revoked', message: '用户已不存在', compensations };
            }
        }
        record.status = types_1.RecordStatus.REVOKE_FAILED;
        record.revokeErrorMessage = `不支持撤销状态: ${record.status}`;
        record.updatedAt = now;
        memoryStore_1.store.updateRecord(record);
        return { status: 'failed', message: `不支持撤销状态: ${record.status}`, compensations };
    }
    revokeBatch(batchId, force) {
        if (this.processingBatches.has(batchId)) {
            return {
                batchId,
                totalProcessed: 0,
                revoked: 0,
                notRevocable: 0,
                failed: 0,
                alreadyRevoked: 0,
                details: []
            };
        }
        const batch = memoryStore_1.store.findBatchById(batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        const allowedStatuses = [
            types_1.BatchStatus.COMPLETED,
            types_1.BatchStatus.PARTIALLY_COMPLETED,
            types_1.BatchStatus.FAILED,
            types_1.BatchStatus.PARTIALLY_REVOKED,
            types_1.BatchStatus.REVOKED
        ];
        if (!allowedStatuses.includes(batch.status) && !force) {
            throw new Error(`批次状态 ${batch.status} 不允许撤销`);
        }
        if (batch.status === types_1.BatchStatus.REVOKED && !force) {
            return this.getIdempotentRevokeResult(batchId, '批次已完全撤销');
        }
        this.processingBatches.add(batchId);
        try {
            batch.status = types_1.BatchStatus.REVOKING;
            batch.updatedAt = Date.now();
            memoryStore_1.store.updateBatch(batch);
            const records = memoryStore_1.store.getRecordsByBatchId(batchId);
            const details = [];
            let revoked = 0;
            let notRevocable = 0;
            let failed = 0;
            let alreadyRevoked = 0;
            records.forEach(record => {
                const result = this.executeRevokeForRecord(record, batchId);
                details.push({
                    email: record.email,
                    status: result.status,
                    message: result.message
                });
                switch (result.status) {
                    case 'revoked':
                        revoked++;
                        break;
                    case 'not_revocable':
                        notRevocable++;
                        break;
                    case 'failed':
                        failed++;
                        break;
                    case 'already_revoked':
                        alreadyRevoked++;
                        revoked++;
                        break;
                }
            });
            const stats = memoryStore_1.store.getBatchStats(batchId);
            batch.revokeCount = stats.revoked;
            if (failed > 0) {
                batch.status = types_1.BatchStatus.PARTIALLY_REVOKED;
            }
            else {
                batch.status = types_1.BatchStatus.REVOKED;
            }
            batch.updatedAt = Date.now();
            memoryStore_1.store.updateBatch(batch);
            return {
                batchId,
                totalProcessed: records.length,
                revoked,
                notRevocable,
                failed,
                alreadyRevoked,
                details
            };
        }
        finally {
            this.processingBatches.delete(batchId);
        }
    }
    revokeSingleUser(batchId, email) {
        const batch = memoryStore_1.store.findBatchById(batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        const record = memoryStore_1.store.findRecordByBatchAndEmail(batchId, email);
        if (!record) {
            throw new Error(`在批次 ${batchId} 中未找到邮箱为 ${email} 的记录`);
        }
        const recordKey = `${batchId}-${email.toLowerCase()}`;
        if (this.processingRecords.has(recordKey)) {
            return {
                batchId,
                totalProcessed: 0,
                revoked: 0,
                notRevocable: 0,
                failed: 0,
                alreadyRevoked: 0,
                details: []
            };
        }
        if (record.status === types_1.RecordStatus.REVOKED) {
            return this.getIdempotentRevokeResult(batchId, '该用户已撤销');
        }
        this.processingRecords.add(recordKey);
        try {
            const result = this.executeRevokeForRecord(record, batchId);
            const stats = memoryStore_1.store.getBatchStats(batchId);
            batch.revokeCount = stats.revoked;
            const allRecords = memoryStore_1.store.getRecordsByBatchId(batchId);
            const allRevoked = allRecords.every(r => r.status === types_1.RecordStatus.REVOKED ||
                r.status === types_1.RecordStatus.NOT_REVOCABLE ||
                r.status === types_1.RecordStatus.SKIPPED ||
                r.status === types_1.RecordStatus.FAILED);
            const hasFailures = allRecords.some(r => r.status === types_1.RecordStatus.REVOKE_FAILED);
            if (hasFailures) {
                batch.status = types_1.BatchStatus.PARTIALLY_REVOKED;
            }
            else if (allRevoked) {
                batch.status = types_1.BatchStatus.REVOKED;
            }
            batch.updatedAt = Date.now();
            memoryStore_1.store.updateBatch(batch);
            return {
                batchId,
                totalProcessed: 1,
                revoked: result.status === 'revoked' || result.status === 'already_revoked' ? 1 : 0,
                notRevocable: result.status === 'not_revocable' ? 1 : 0,
                failed: result.status === 'failed' ? 1 : 0,
                alreadyRevoked: result.status === 'already_revoked' ? 1 : 0,
                details: [{
                        email: record.email,
                        status: result.status,
                        message: result.message
                    }]
            };
        }
        finally {
            this.processingRecords.delete(recordKey);
        }
    }
    getIdempotentRevokeResult(batchId, message) {
        const records = memoryStore_1.store.getRecordsByBatchId(batchId);
        const details = records.map(r => ({
            email: r.email,
            status: r.status === types_1.RecordStatus.REVOKED ? 'already_revoked' :
                r.status === types_1.RecordStatus.NOT_REVOCABLE ? 'not_revocable' : 'failed',
            message: message
        }));
        return {
            batchId,
            totalProcessed: records.length,
            revoked: records.filter(r => r.status === types_1.RecordStatus.REVOKED).length,
            notRevocable: records.filter(r => r.status === types_1.RecordStatus.NOT_REVOCABLE).length,
            failed: records.filter(r => r.status === types_1.RecordStatus.REVOKE_FAILED).length,
            alreadyRevoked: records.filter(r => r.status === types_1.RecordStatus.REVOKED).length,
            details
        };
    }
}
exports.revokeService = RevokeService.getInstance();
