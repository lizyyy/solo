"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whitelistModel = exports.WhitelistModel = exports.RateLimitUnit = exports.WhitelistStatus = void 0;
const uuid_1 = require("uuid");
var WhitelistStatus;
(function (WhitelistStatus) {
    WhitelistStatus["PENDING_APPROVAL"] = "pending_approval";
    WhitelistStatus["ACTIVE"] = "active";
    WhitelistStatus["EXPIRING_SOON"] = "expiring_soon";
    WhitelistStatus["EXPIRED"] = "expired";
    WhitelistStatus["REVOKED"] = "revoked";
    WhitelistStatus["REJECTED"] = "rejected";
})(WhitelistStatus || (exports.WhitelistStatus = WhitelistStatus = {}));
var RateLimitUnit;
(function (RateLimitUnit) {
    RateLimitUnit["SECOND"] = "second";
    RateLimitUnit["MINUTE"] = "minute";
    RateLimitUnit["HOUR"] = "hour";
    RateLimitUnit["DAY"] = "day";
})(RateLimitUnit || (exports.RateLimitUnit = RateLimitUnit = {}));
class WhitelistModel {
    constructor() {
        this.records = new Map();
        this.histories = new Map();
        this.historyByRecordId = new Map();
    }
    create(request) {
        const now = new Date();
        const record = {
            id: (0, uuid_1.v4)(),
            ...request,
            status: WhitelistStatus.PENDING_APPROVAL,
            createdAt: now,
            updatedAt: now,
            version: 1
        };
        this.records.set(record.id, record);
        this.addHistory(record.id, 'CREATE', request.applicant, undefined, record);
        return record;
    }
    findById(id) {
        return this.records.get(id);
    }
    findAll(filters) {
        let result = Array.from(this.records.values());
        if (filters?.tenantId) {
            result = result.filter(r => r.tenantId === filters.tenantId);
        }
        if (filters?.apiGroupId) {
            result = result.filter(r => r.apiGroupId === filters.apiGroupId);
        }
        if (filters?.status) {
            result = result.filter(r => r.status === filters.status);
        }
        return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    findByTenantAndApiGroup(tenantId, apiGroupId) {
        return this.findAll().filter(r => r.tenantId === tenantId && r.apiGroupId === apiGroupId);
    }
    update(id, updates, operator) {
        const record = this.records.get(id);
        if (!record)
            return undefined;
        const oldValue = { ...record };
        const updatedRecord = {
            ...record,
            ...updates,
            updatedAt: new Date(),
            version: record.version + 1
        };
        this.records.set(id, updatedRecord);
        this.addHistory(id, 'UPDATE', operator, oldValue, updatedRecord);
        return updatedRecord;
    }
    updateStatus(id, status, operator, remark) {
        const record = this.records.get(id);
        if (!record)
            return undefined;
        const oldValue = { ...record };
        const updatedRecord = {
            ...record,
            status,
            updatedAt: new Date(),
            version: record.version + 1
        };
        this.records.set(id, updatedRecord);
        this.addHistory(id, `STATUS_${status.toUpperCase()}`, operator, oldValue, updatedRecord, remark);
        return updatedRecord;
    }
    approve(id, approver, remark) {
        const record = this.records.get(id);
        if (!record)
            return undefined;
        const oldValue = { ...record };
        const now = new Date();
        const updatedRecord = {
            ...record,
            status: WhitelistStatus.ACTIVE,
            approver,
            updatedAt: now,
            version: record.version + 1
        };
        this.records.set(id, updatedRecord);
        this.addHistory(id, 'APPROVE', approver, oldValue, updatedRecord, remark);
        return updatedRecord;
    }
    reject(id, approver, remark) {
        return this.updateStatus(id, WhitelistStatus.REJECTED, approver, remark);
    }
    revoke(id, operator, remark) {
        return this.updateStatus(id, WhitelistStatus.REVOKED, operator, remark);
    }
    getHistories(recordId) {
        const historyIds = this.historyByRecordId.get(recordId) || [];
        return historyIds
            .map(id => this.histories.get(id))
            .filter((h) => h !== undefined)
            .sort((a, b) => b.operatedAt.getTime() - a.operatedAt.getTime());
    }
    addHistory(recordId, action, operator, oldValue, newValue, remark) {
        const history = {
            id: (0, uuid_1.v4)(),
            recordId,
            action,
            operator,
            oldValue,
            newValue,
            remark,
            operatedAt: new Date()
        };
        this.histories.set(history.id, history);
        if (!this.historyByRecordId.has(recordId)) {
            this.historyByRecordId.set(recordId, []);
        }
        this.historyByRecordId.get(recordId).push(history.id);
    }
    bulkImport(records) {
        const success = [];
        const failed = [];
        records.forEach((data, index) => {
            try {
                const record = this.create(data);
                success.push(record);
            }
            catch (error) {
                failed.push({
                    row: index + 1,
                    error: error instanceof Error ? error.message : '未知错误',
                    data
                });
            }
        });
        return { success, failed };
    }
    export() {
        return this.findAll();
    }
    clear() {
        this.records.clear();
        this.histories.clear();
        this.historyByRecordId.clear();
    }
}
exports.WhitelistModel = WhitelistModel;
exports.whitelistModel = new WhitelistModel();
