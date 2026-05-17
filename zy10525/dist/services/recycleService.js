"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recycleService = exports.RecycleService = void 0;
const recycleStore_1 = require("../store/recycleStore");
const types_1 = require("../types");
const VALID_TRANSITIONS = {
    [types_1.RecycleStatus.PENDING]: [types_1.RecycleStatus.IN_PROGRESS, types_1.RecycleStatus.CANCELLED, types_1.RecycleStatus.EXPIRED],
    [types_1.RecycleStatus.IN_PROGRESS]: [types_1.RecycleStatus.COMPLETED, types_1.RecycleStatus.ERROR, types_1.RecycleStatus.CANCELLED],
    [types_1.RecycleStatus.COMPLETED]: [],
    [types_1.RecycleStatus.CANCELLED]: [],
    [types_1.RecycleStatus.EXPIRED]: [types_1.RecycleStatus.PENDING],
    [types_1.RecycleStatus.ERROR]: [types_1.RecycleStatus.PENDING, types_1.RecycleStatus.CANCELLED]
};
class RecycleService {
    create(request) {
        return recycleStore_1.recycleStore.create(request);
    }
    findById(id) {
        return recycleStore_1.recycleStore.findById(id);
    }
    query(params) {
        return recycleStore_1.recycleStore.query(params);
    }
    transitionStatus(id, request) {
        const record = recycleStore_1.recycleStore.findById(id);
        if (!record) {
            return null;
        }
        const validTransitions = VALID_TRANSITIONS[record.status];
        if (!validTransitions.includes(request.status)) {
            throw new Error(`Invalid status transition from ${record.status} to ${request.status}`);
        }
        return recycleStore_1.recycleStore.updateStatus(id, request.status, request.operator, request.remark);
    }
    addException(id, originalInput, errorMessage) {
        return recycleStore_1.recycleStore.addException(id, originalInput, errorMessage);
    }
    handleException(id, exceptionId, request) {
        return recycleStore_1.recycleStore.handleException(id, exceptionId, request.handler, request.resolution);
    }
    manualCorrection(id, request) {
        const { operator, reason, configKey, grayScope, owner, recycleDate, hitTenants } = request;
        const updateData = {};
        if (configKey !== undefined)
            updateData.configKey = configKey;
        if (grayScope !== undefined)
            updateData.grayScope = grayScope;
        if (owner !== undefined)
            updateData.owner = owner;
        if (recycleDate !== undefined)
            updateData.recycleDate = new Date(recycleDate);
        if (hitTenants !== undefined)
            updateData.hitTenants = hitTenants;
        return recycleStore_1.recycleStore.manualCorrection(id, updateData, operator, reason);
    }
    getAllForExport() {
        return recycleStore_1.recycleStore.getAll();
    }
    checkExpirations() {
        const now = new Date();
        const records = recycleStore_1.recycleStore.getAll();
        for (const record of records) {
            if (record.status === types_1.RecycleStatus.PENDING && record.recycleDate <= now) {
                recycleStore_1.recycleStore.updateStatus(record.id, types_1.RecycleStatus.EXPIRED, 'system');
            }
        }
    }
    sendReminders() {
        const now = new Date();
        const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const records = recycleStore_1.recycleStore.getAll();
        for (const record of records) {
            if (record.status === types_1.RecycleStatus.PENDING &&
                record.recycleDate <= threeDaysLater &&
                record.remindersSent < 3) {
                recycleStore_1.recycleStore.incrementReminder(record.id);
            }
        }
    }
    updateHitTenants(id, tenants) {
        return recycleStore_1.recycleStore.updateHitTenants(id, tenants);
    }
}
exports.RecycleService = RecycleService;
exports.recycleService = new RecycleService();
