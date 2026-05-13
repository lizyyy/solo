"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = void 0;
const types_1 = require("../types");
const memoryStore_1 = require("../store/memoryStore");
class ReportService {
    constructor() { }
    static getInstance() {
        if (!ReportService.instance) {
            ReportService.instance = new ReportService();
        }
        return ReportService.instance;
    }
    generateBatchReport(batchId) {
        const batch = memoryStore_1.store.findBatchById(batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        const records = memoryStore_1.store.getRecordsByBatchId(batchId);
        const stats = memoryStore_1.store.getBatchStats(batchId);
        const reportRecords = records.map(record => {
            const canBeRevoked = this.canBeRevoked(record);
            return {
                email: record.email,
                name: record.name,
                status: record.status,
                isPreExisting: record.isPreExisting,
                canBeRevoked,
                errorMessage: record.errorMessage,
                revokeErrorMessage: record.revokeErrorMessage
            };
        });
        return {
            batchId: batch.id,
            batchName: batch.name,
            status: batch.status,
            summary: {
                total: stats.total,
                created: stats.created,
                updated: stats.updated,
                skipped: stats.skipped,
                failed: stats.failed,
                revoked: stats.revoked,
                notRevocable: stats.notRevocable,
                revokeFailed: stats.revokeFailed
            },
            records: reportRecords,
            warnings: batch.precheckWarnings
        };
    }
    canBeRevoked(record) {
        if (record.status === types_1.RecordStatus.REVOKED) {
            return true;
        }
        if (record.status === types_1.RecordStatus.NOT_REVOCABLE) {
            return false;
        }
        if (record.isPreExisting && record.status === types_1.RecordStatus.CREATED) {
            return false;
        }
        if (record.status === types_1.RecordStatus.SKIPPED || record.status === types_1.RecordStatus.FAILED) {
            return true;
        }
        if (record.status === types_1.RecordStatus.CREATED || record.status === types_1.RecordStatus.UPDATED) {
            return true;
        }
        if (record.status === types_1.RecordStatus.REVOKE_FAILED) {
            return true;
        }
        return false;
    }
    getUsersWithBatchSource() {
        const users = memoryStore_1.store.getAllUsers();
        const batches = new Map(memoryStore_1.store.getAllBatches().map(b => [b.id, b]));
        const usersWithInfo = [];
        users.forEach(user => {
            const userInfo = {
                ...user,
                sourceBatchId: user.sourceBatchId
            };
            if (user.sourceBatchId) {
                const batch = batches.get(user.sourceBatchId);
                if (batch) {
                    userInfo.sourceBatchName = batch.name;
                    const record = memoryStore_1.store.findRecordByBatchAndEmail(user.sourceBatchId, user.email);
                    if (record) {
                        userInfo.isPreExistingInBatch = record.isPreExisting;
                        userInfo.importStatus = record.status;
                        if (record.status === types_1.RecordStatus.REVOKED ||
                            record.status === types_1.RecordStatus.REVOKE_FAILED ||
                            record.status === types_1.RecordStatus.NOT_REVOCABLE) {
                            userInfo.revokeStatus = record.status;
                            userInfo.revokeErrorMessage = record.revokeErrorMessage;
                        }
                    }
                }
            }
            usersWithInfo.push(userInfo);
        });
        return usersWithInfo;
    }
    getUserDetailWithBatchInfo(email) {
        const user = memoryStore_1.store.findUserByEmail(email);
        if (!user) {
            return null;
        }
        const userInfo = {
            ...user,
            sourceBatchId: user.sourceBatchId
        };
        if (user.sourceBatchId) {
            const batch = memoryStore_1.store.findBatchById(user.sourceBatchId);
            if (batch) {
                userInfo.sourceBatchName = batch.name;
                const record = memoryStore_1.store.findRecordByBatchAndEmail(user.sourceBatchId, email);
                if (record) {
                    userInfo.isPreExistingInBatch = record.isPreExisting;
                    userInfo.importStatus = record.status;
                    userInfo.revokeStatus = record.status;
                    userInfo.revokeErrorMessage = record.revokeErrorMessage;
                }
            }
        }
        return userInfo;
    }
    getReimportContext(batchId) {
        const records = memoryStore_1.store.getRecordsByBatchId(batchId);
        const batch = memoryStore_1.store.findBatchById(batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        const errors = [];
        const preExistingUsers = [];
        records.forEach(record => {
            if (record.isPreExisting) {
                preExistingUsers.push(record.email);
            }
            record.precheckWarnings.forEach(warning => {
                if (warning.type === 'role_not_found') {
                    errors.push({
                        email: record.email,
                        type: 'role_error',
                        message: warning.message,
                        detail: warning.detail
                    });
                }
                if (warning.type === 'department_not_found') {
                    errors.push({
                        email: record.email,
                        type: 'department_error',
                        message: warning.message,
                        detail: warning.detail
                    });
                }
            });
            if (record.errorMessage) {
                errors.push({
                    email: record.email,
                    type: 'other',
                    message: record.errorMessage,
                    detail: null
                });
            }
        });
        return {
            originalRecords: records.map(r => ({
                email: r.email,
                name: r.name,
                departmentId: r.departmentId,
                roleIds: r.roleIds,
                status: r.status,
                isPreExisting: r.isPreExisting
            })),
            previousMappings: {
                roleMappings: {},
                departmentMappings: {}
            },
            errors,
            preExistingUsers
        };
    }
}
exports.reportService = ReportService.getInstance();
