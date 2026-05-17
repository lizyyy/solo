"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recycleStore = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class RecycleStore {
    constructor() {
        this.records = new Map();
    }
    create(request) {
        const id = (0, uuid_1.v4)();
        const now = new Date();
        const record = {
            id,
            configKey: request.configKey,
            grayScope: request.grayScope,
            owner: request.owner,
            recycleDate: new Date(request.recycleDate),
            hitTenants: request.hitTenants || [],
            status: types_1.RecycleStatus.PENDING,
            exceptions: [],
            createdAt: now,
            updatedAt: now,
            remindersSent: 0
        };
        this.records.set(id, record);
        return record;
    }
    findById(id) {
        return this.records.get(id);
    }
    query(request) {
        const page = request.page || 1;
        const pageSize = request.pageSize || 10;
        let results = Array.from(this.records.values());
        if (request.configKey) {
            results = results.filter(r => r.configKey.includes(request.configKey));
        }
        if (request.owner) {
            results = results.filter(r => r.owner === request.owner);
        }
        if (request.status) {
            results = results.filter(r => r.status === request.status);
        }
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const total = results.length;
        const start = (page - 1) * pageSize;
        const data = results.slice(start, start + pageSize);
        return {
            data,
            total,
            page,
            pageSize
        };
    }
    updateStatus(id, status, operator, remark) {
        const record = this.records.get(id);
        if (!record)
            return null;
        record.status = status;
        record.updatedAt = new Date();
        if (status === types_1.RecycleStatus.COMPLETED) {
            record.report = {
                recycledCount: record.hitTenants.length,
                failedCount: 0,
                details: record.hitTenants.map(tenantId => ({
                    tenantId,
                    status: 'success'
                })),
                completedAt: new Date()
            };
        }
        return record;
    }
    addException(id, originalInput, errorMessage) {
        const record = this.records.get(id);
        if (!record)
            return null;
        const exception = {
            id: (0, uuid_1.v4)(),
            originalInput: JSON.parse(JSON.stringify(originalInput)),
            errorMessage,
            handler: '',
            handledAt: new Date(),
            resolution: ''
        };
        record.exceptions.push(exception);
        record.status = types_1.RecycleStatus.ERROR;
        record.updatedAt = new Date();
        return exception;
    }
    handleException(id, exceptionId, handler, resolution) {
        const record = this.records.get(id);
        if (!record)
            return null;
        const exception = record.exceptions.find(e => e.id === exceptionId);
        if (!exception)
            return null;
        exception.handler = handler;
        exception.resolution = resolution;
        exception.handledAt = new Date();
        record.status = types_1.RecycleStatus.PENDING;
        record.updatedAt = new Date();
        return record;
    }
    manualCorrection(id, updates, operator, reason) {
        const record = this.records.get(id);
        if (!record)
            return null;
        const originalInput = JSON.parse(JSON.stringify({
            id: record.id,
            configKey: record.configKey,
            grayScope: record.grayScope,
            owner: record.owner,
            recycleDate: record.recycleDate,
            hitTenants: record.hitTenants,
            status: record.status,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        }));
        if (updates.configKey !== undefined)
            record.configKey = updates.configKey;
        if (updates.grayScope !== undefined)
            record.grayScope = updates.grayScope;
        if (updates.owner !== undefined)
            record.owner = updates.owner;
        if (updates.recycleDate !== undefined)
            record.recycleDate = updates.recycleDate;
        if (updates.hitTenants !== undefined)
            record.hitTenants = updates.hitTenants;
        record.updatedAt = new Date();
        const exception = {
            id: (0, uuid_1.v4)(),
            originalInput,
            errorMessage: `Manual correction by ${operator}: ${reason}`,
            handler: operator,
            handledAt: new Date(),
            resolution: reason
        };
        record.exceptions.push(exception);
        return record;
    }
    getAll() {
        return Array.from(this.records.values());
    }
    updateHitTenants(id, tenants) {
        const record = this.records.get(id);
        if (!record)
            return null;
        record.hitTenants = tenants;
        record.updatedAt = new Date();
        return record;
    }
    incrementReminder(id) {
        const record = this.records.get(id);
        if (!record)
            return null;
        record.remindersSent += 1;
        record.lastReminderAt = new Date();
        record.updatedAt = new Date();
        return record;
    }
}
exports.recycleStore = new RecycleStore();
