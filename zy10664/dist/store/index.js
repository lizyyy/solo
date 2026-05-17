"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class DataStore {
    constructor() {
        this.tasks = new Map();
        this.recoveryConditions = new Map();
        this.failureRecords = new Map();
        this.auditHistories = new Map();
    }
    createTask(data) {
        const now = new Date();
        const task = {
            id: (0, uuid_1.v4)(),
            ...data,
            status: types_1.TaskStatus.RUNNING,
            failureCount: 0,
            hasQueuedRetry: false,
            createdAt: now,
            updatedAt: now
        };
        this.tasks.set(task.id, task);
        this.recoveryConditions.set(task.id, []);
        this.failureRecords.set(task.id, []);
        this.auditHistories.set(task.id, []);
        return task;
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    getTaskByCode(taskCode) {
        for (const task of this.tasks.values()) {
            if (task.taskCode === taskCode) {
                return task;
            }
        }
        return undefined;
    }
    updateTask(id, data) {
        const task = this.tasks.get(id);
        if (!task)
            return undefined;
        const updated = { ...task, ...data, updatedAt: new Date() };
        this.tasks.set(id, updated);
        return updated;
    }
    listTasks(query) {
        let result = Array.from(this.tasks.values());
        if (query?.status) {
            result = result.filter(t => t.status === query.status);
        }
        if (query?.taskCode) {
            result = result.filter(t => t.taskCode.includes(query.taskCode));
        }
        if (query?.schedulerName) {
            result = result.filter(t => t.schedulerName.includes(query.schedulerName));
        }
        const total = result.length;
        if (query?.page && query?.pageSize) {
            const start = (query.page - 1) * query.pageSize;
            result = result.slice(start, start + query.pageSize);
        }
        return { total, data: result };
    }
    addRecoveryCondition(taskId, data) {
        const condition = {
            id: (0, uuid_1.v4)(),
            taskId,
            ...data,
            isMet: false,
            createdAt: new Date()
        };
        const conditions = this.recoveryConditions.get(taskId) || [];
        conditions.push(condition);
        this.recoveryConditions.set(taskId, conditions);
        return condition;
    }
    getRecoveryConditions(taskId) {
        return this.recoveryConditions.get(taskId) || [];
    }
    updateRecoveryCondition(conditionId, data) {
        for (const [taskId, conditions] of this.recoveryConditions.entries()) {
            const index = conditions.findIndex(c => c.id === conditionId);
            if (index !== -1) {
                conditions[index] = { ...conditions[index], ...data };
                this.recoveryConditions.set(taskId, conditions);
                return conditions[index];
            }
        }
        return undefined;
    }
    addFailureRecord(taskId, data) {
        const record = {
            id: (0, uuid_1.v4)(),
            taskId,
            ...data
        };
        const records = this.failureRecords.get(taskId) || [];
        records.push(record);
        this.failureRecords.set(taskId, records);
        return record;
    }
    getFailureRecords(taskId) {
        return this.failureRecords.get(taskId) || [];
    }
    updateFailureRecord(recordId, data) {
        for (const [taskId, records] of this.failureRecords.entries()) {
            const index = records.findIndex(r => r.id === recordId);
            if (index !== -1) {
                records[index] = { ...records[index], ...data };
                this.failureRecords.set(taskId, records);
                return records[index];
            }
        }
        return undefined;
    }
    addAuditHistory(taskId, data) {
        const history = {
            id: (0, uuid_1.v4)(),
            taskId,
            ...data,
            createdAt: new Date()
        };
        const histories = this.auditHistories.get(taskId) || [];
        histories.push(history);
        this.auditHistories.set(taskId, histories);
        return history;
    }
    getAuditHistories(taskId) {
        return this.auditHistories.get(taskId) || [];
    }
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    clearAll() {
        this.tasks.clear();
        this.recoveryConditions.clear();
        this.failureRecords.clear();
        this.auditHistories.clear();
    }
}
exports.store = new DataStore();
