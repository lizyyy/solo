"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.refundReviews = new Map();
        this.auditLogs = new Map();
        this.conflictRecords = new Map();
        this.importBadRows = new Map();
        this.idempotentKeys = new Set();
    }
    saveRefundReview(review) {
        this.refundReviews.set(review.id, { ...review, updateTime: new Date().toISOString() });
        return this.refundReviews.get(review.id);
    }
    getRefundReview(id) {
        return this.refundReviews.get(id);
    }
    listRefundReviews(page, pageSize, filters) {
        let list = Array.from(this.refundReviews.values());
        if (filters) {
            if (filters.status) {
                list = list.filter(item => item.status === filters.status);
            }
            if (filters.userId) {
                list = list.filter(item => item.orderInfo.userId === filters.userId);
            }
            if (filters.orderNo) {
                list = list.filter(item => item.orderInfo.orderNo.includes(filters.orderNo));
            }
        }
        list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return {
            list: list.slice(start, end),
            total: list.length
        };
    }
    checkIdempotentKey(key) {
        return this.idempotentKeys.has(key);
    }
    addIdempotentKey(key) {
        this.idempotentKeys.add(key);
    }
    saveAuditLog(log) {
        const auditLog = {
            ...log,
            id: (0, uuid_1.v4)()
        };
        this.auditLogs.set(auditLog.id, auditLog);
        return auditLog;
    }
    listAuditLogs(refundReviewId) {
        return Array.from(this.auditLogs.values())
            .filter(log => log.refundReviewId === refundReviewId)
            .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    }
    saveConflictRecord(record) {
        const conflictRecord = {
            ...record,
            id: (0, uuid_1.v4)()
        };
        this.conflictRecords.set(conflictRecord.id, conflictRecord);
        return conflictRecord;
    }
    listConflictRecords(refundReviewId) {
        let list = Array.from(this.conflictRecords.values());
        if (refundReviewId) {
            list = list.filter(r => r.refundReviewId === refundReviewId);
        }
        return list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    }
    saveImportBadRow(row) {
        const badRow = {
            ...row,
            id: (0, uuid_1.v4)()
        };
        this.importBadRows.set(badRow.id, badRow);
        return badRow;
    }
    listImportBadRows(batchId) {
        let list = Array.from(this.importBadRows.values());
        if (batchId) {
            list = list.filter(r => r.importBatchId === batchId);
        }
        return list.sort((a, b) => a.rowNumber - b.rowNumber);
    }
    getSplitOrderGroupReviews(groupId) {
        return Array.from(this.refundReviews.values())
            .filter(r => r.splitOrderGroupId === groupId);
    }
}
exports.dataStore = new DataStore();
