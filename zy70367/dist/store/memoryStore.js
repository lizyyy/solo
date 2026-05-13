"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const types_1 = require("../types");
class MemoryStore {
    constructor() {
        this.users = new Map();
        this.batches = new Map();
        this.records = new Map();
        this.userEmailIndex = new Map();
        this.batchRecordsIndex = new Map();
        this.userSourceBatchIndex = new Map();
        this.userOriginalRoleIds = new Map();
        this.initializeSeedData();
    }
    static getInstance() {
        if (!MemoryStore.instance) {
            MemoryStore.instance = new MemoryStore();
        }
        return MemoryStore.instance;
    }
    initializeSeedData() {
        const now = Date.now();
        const existingUsers = [
            {
                id: 'u-001',
                email: 'wanggang@company.com',
                name: '王刚',
                departmentId: 'dept-tech',
                roleIds: ['role-manager', 'role-developer'],
                createdAt: now - 86400000 * 30,
                updatedAt: now - 86400000 * 10,
                originalUser: true
            },
            {
                id: 'u-002',
                email: 'liming@company.com',
                name: '李明',
                departmentId: 'dept-hr',
                roleIds: ['role-hr-admin'],
                createdAt: now - 86400000 * 60,
                updatedAt: now - 86400000 * 5,
                originalUser: true
            },
            {
                id: 'u-003',
                email: 'zhangwei@company.com',
                name: '张伟',
                departmentId: 'dept-finance',
                roleIds: ['role-finance'],
                createdAt: now - 86400000 * 120,
                updatedAt: now - 86400000 * 2,
                originalUser: true
            }
        ];
        existingUsers.forEach(user => {
            this.users.set(user.id, user);
            this.userEmailIndex.set(user.email.toLowerCase(), user.id);
        });
    }
    findUserById(id) {
        return this.users.get(id);
    }
    findUserByEmail(email) {
        const userId = this.userEmailIndex.get(email.toLowerCase());
        return userId ? this.users.get(userId) : undefined;
    }
    getUserByBatchId(batchId) {
        return Array.from(this.users.values()).filter(u => u.sourceBatchId === batchId);
    }
    getAllUsers() {
        return Array.from(this.users.values());
    }
    createUser(user) {
        this.users.set(user.id, user);
        this.userEmailIndex.set(user.email.toLowerCase(), user.id);
        if (user.sourceBatchId) {
            this.userSourceBatchIndex.set(user.id, user.sourceBatchId);
        }
        return user;
    }
    updateUser(user) {
        this.users.set(user.id, user);
        return user;
    }
    deleteUser(id) {
        const user = this.users.get(id);
        if (user) {
            this.users.delete(id);
            this.userEmailIndex.delete(user.email.toLowerCase());
            this.userSourceBatchIndex.delete(id);
            this.userOriginalRoleIds.delete(id);
            return true;
        }
        return false;
    }
    getUserSourceBatch(userId) {
        return this.userSourceBatchIndex.get(userId);
    }
    setUserOriginalRoleIds(userId, roleIds) {
        this.userOriginalRoleIds.set(userId, roleIds);
    }
    getUserOriginalRoleIds(userId) {
        return this.userOriginalRoleIds.get(userId);
    }
    createBatch(batch) {
        this.batches.set(batch.id, batch);
        this.batchRecordsIndex.set(batch.id, []);
        return batch;
    }
    updateBatch(batch) {
        this.batches.set(batch.id, batch);
        return batch;
    }
    findBatchById(id) {
        return this.batches.get(id);
    }
    getAllBatches() {
        return Array.from(this.batches.values());
    }
    createRecord(record) {
        this.records.set(record.id, record);
        const batchRecords = this.batchRecordsIndex.get(record.batchId) || [];
        batchRecords.push(record.id);
        this.batchRecordsIndex.set(record.batchId, batchRecords);
        return record;
    }
    updateRecord(record) {
        this.records.set(record.id, record);
        return record;
    }
    findRecordById(id) {
        return this.records.get(id);
    }
    getRecordsByBatchId(batchId) {
        const recordIds = this.batchRecordsIndex.get(batchId) || [];
        return recordIds.map(id => this.records.get(id)).filter(Boolean);
    }
    findRecordByBatchAndEmail(batchId, email) {
        return this.getRecordsByBatchId(batchId).find(r => r.email.toLowerCase() === email.toLowerCase());
    }
    getBatchStats(batchId) {
        const records = this.getRecordsByBatchId(batchId);
        return {
            total: records.length,
            created: records.filter(r => r.status === types_1.RecordStatus.CREATED).length,
            updated: records.filter(r => r.status === types_1.RecordStatus.UPDATED).length,
            skipped: records.filter(r => r.status === types_1.RecordStatus.SKIPPED).length,
            failed: records.filter(r => r.status === types_1.RecordStatus.FAILED).length,
            revoked: records.filter(r => r.status === types_1.RecordStatus.REVOKED).length,
            notRevocable: records.filter(r => r.status === types_1.RecordStatus.NOT_REVOCABLE).length,
            revokeFailed: records.filter(r => r.status === types_1.RecordStatus.REVOKE_FAILED).length
        };
    }
}
exports.store = MemoryStore.getInstance();
