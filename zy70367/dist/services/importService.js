"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const memoryStore_1 = require("../store/memoryStore");
const referenceService_1 = require("./referenceService");
class ImportService {
    constructor() { }
    static getInstance() {
        if (!ImportService.instance) {
            ImportService.instance = new ImportService();
        }
        return ImportService.instance;
    }
    createBatch(input, mappingConfig) {
        const now = Date.now();
        const batch = {
            id: `batch-${(0, uuid_1.v4)()}`,
            name: input.name,
            status: types_1.BatchStatus.CREATED,
            creatorId: input.creatorId,
            createdAt: now,
            updatedAt: now,
            totalRecords: input.users.length,
            successCount: 0,
            failCount: 0,
            revokeCount: 0,
            precheckWarnings: []
        };
        const createdBatch = memoryStore_1.store.createBatch(batch);
        const seenEmails = new Set();
        input.users.forEach(userInput => {
            const email = userInput.email.toLowerCase();
            const isDuplicateInBatch = seenEmails.has(email);
            seenEmails.add(email);
            const existingUser = memoryStore_1.store.findUserByEmail(email);
            const isPreExisting = !!existingUser;
            let departmentId;
            if (userInput.departmentName) {
                const dept = referenceService_1.referenceService.findDepartmentByName(userInput.departmentName);
                if (dept) {
                    departmentId = dept.id;
                }
            }
            const roleIds = [];
            userInput.roleNames.forEach(roleName => {
                const role = referenceService_1.referenceService.findRoleByName(roleName);
                if (role) {
                    roleIds.push(role.id);
                }
            });
            const precheckWarnings = [];
            if (isDuplicateInBatch) {
                precheckWarnings.push({
                    type: types_1.PrecheckWarningType.DUPLICATE_EMAIL,
                    message: `批次内存在重复邮箱: ${userInput.email}`,
                    detail: { email: userInput.email }
                });
            }
            if (isPreExisting) {
                precheckWarnings.push({
                    type: types_1.PrecheckWarningType.USER_EXISTS,
                    message: `用户已存在，将执行更新操作: ${userInput.email}`,
                    detail: { email: userInput.email, existingUserId: existingUser?.id }
                });
            }
            if (userInput.departmentName && !departmentId) {
                precheckWarnings.push({
                    type: types_1.PrecheckWarningType.DEPARTMENT_NOT_FOUND,
                    message: `部门不存在: ${userInput.departmentName}`,
                    detail: { departmentName: userInput.departmentName }
                });
            }
            userInput.roleNames.forEach(roleName => {
                const role = referenceService_1.referenceService.findRoleByName(roleName);
                if (!role) {
                    precheckWarnings.push({
                        type: types_1.PrecheckWarningType.ROLE_NOT_FOUND,
                        message: `角色不存在: ${roleName}`,
                        detail: { roleName }
                    });
                }
            });
            const record = {
                id: `rec-${(0, uuid_1.v4)()}`,
                batchId: createdBatch.id,
                email: userInput.email,
                name: userInput.name,
                departmentId,
                roleIds,
                originalRoleIds: existingUser?.roleIds,
                status: types_1.RecordStatus.PENDING,
                isPreExisting,
                precheckWarnings,
                createdAt: now,
                updatedAt: now
            };
            memoryStore_1.store.createRecord(record);
        });
        return createdBatch;
    }
    precheckBatch(batchId) {
        const batch = memoryStore_1.store.findBatchById(batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        batch.status = types_1.BatchStatus.PRECHECKING;
        batch.updatedAt = Date.now();
        memoryStore_1.store.updateBatch(batch);
        const records = memoryStore_1.store.getRecordsByBatchId(batchId);
        const perUserWarnings = new Map();
        const allWarnings = [];
        records.forEach(record => {
            perUserWarnings.set(record.email, record.precheckWarnings);
            allWarnings.push(...record.precheckWarnings);
        });
        batch.status = types_1.BatchStatus.PRECHECKED;
        batch.precheckWarnings = allWarnings;
        batch.updatedAt = Date.now();
        memoryStore_1.store.updateBatch(batch);
        return {
            batchId,
            warnings: allWarnings,
            perUserWarnings
        };
    }
    confirmImport(batchId) {
        const batch = memoryStore_1.store.findBatchById(batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        if (batch.status === types_1.BatchStatus.COMPLETED || batch.status === types_1.BatchStatus.PARTIALLY_COMPLETED) {
            return { batch, results: memoryStore_1.store.getRecordsByBatchId(batchId) };
        }
        batch.status = types_1.BatchStatus.IMPORTING;
        batch.updatedAt = Date.now();
        memoryStore_1.store.updateBatch(batch);
        const records = memoryStore_1.store.getRecordsByBatchId(batchId);
        const now = Date.now();
        let successCount = 0;
        let failCount = 0;
        const results = [];
        records.forEach(record => {
            try {
                if (record.precheckWarnings.some(w => w.type === types_1.PrecheckWarningType.DUPLICATE_EMAIL)) {
                    record.status = types_1.RecordStatus.SKIPPED;
                    record.errorMessage = '批次内重复邮箱，跳过导入';
                    record.updatedAt = now;
                    memoryStore_1.store.updateRecord(record);
                    results.push(record);
                    return;
                }
                let user = memoryStore_1.store.findUserByEmail(record.email);
                const wasExisting = !!user;
                if (user) {
                    memoryStore_1.store.setUserOriginalRoleIds(user.id, [...user.roleIds]);
                    if (record.departmentId) {
                        user.departmentId = record.departmentId;
                    }
                    if (record.roleIds.length > 0) {
                        user.roleIds = record.roleIds;
                    }
                    user.updatedAt = now;
                    if (!user.sourceBatchId) {
                        user.sourceBatchId = batchId;
                    }
                    user = memoryStore_1.store.updateUser(user);
                    record.status = types_1.RecordStatus.UPDATED;
                    record.updatedAt = now;
                    memoryStore_1.store.updateRecord(record);
                    successCount++;
                }
                else {
                    const newUser = {
                        id: `u-${(0, uuid_1.v4)()}`,
                        email: record.email,
                        name: record.name,
                        departmentId: record.departmentId,
                        roleIds: record.roleIds,
                        createdAt: now,
                        updatedAt: now,
                        sourceBatchId: batchId,
                        originalUser: false
                    };
                    memoryStore_1.store.createUser(newUser);
                    memoryStore_1.store.setUserOriginalRoleIds(newUser.id, []);
                    record.status = types_1.RecordStatus.CREATED;
                    record.updatedAt = now;
                    memoryStore_1.store.updateRecord(record);
                    successCount++;
                }
                results.push(record);
            }
            catch (error) {
                record.status = types_1.RecordStatus.FAILED;
                record.errorMessage = error?.message || '导入失败';
                record.updatedAt = now;
                memoryStore_1.store.updateRecord(record);
                failCount++;
                results.push(record);
            }
        });
        batch.successCount = successCount;
        batch.failCount = failCount;
        batch.totalRecords = records.length;
        if (failCount === 0) {
            batch.status = types_1.BatchStatus.COMPLETED;
        }
        else if (successCount > 0) {
            batch.status = types_1.BatchStatus.PARTIALLY_COMPLETED;
        }
        else {
            batch.status = types_1.BatchStatus.FAILED;
        }
        batch.updatedAt = now;
        memoryStore_1.store.updateBatch(batch);
        return { batch, results };
    }
    getBatch(batchId) {
        return memoryStore_1.store.findBatchById(batchId);
    }
    getBatchRecords(batchId) {
        return memoryStore_1.store.getRecordsByBatchId(batchId);
    }
    getAllBatches() {
        return memoryStore_1.store.getAllBatches();
    }
}
exports.importService = ImportService.getInstance();
