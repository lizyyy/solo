"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingService = exports.BillingService = void 0;
const store_1 = require("../store");
const billingEngine_1 = require("./billingEngine");
class BillingService {
    calculateAndUpdateRecord(recordId, operator) {
        const record = store_1.dataStore.getRecordById(recordId);
        if (!record)
            return null;
        const result = billingEngine_1.billingEngine.calculateBilling(record);
        store_1.dataStore.updateRecord(recordId, {
            calculatedAmount: result.calculatedAmount,
            finalAmount: result.finalAmount,
            exceptions: result.exceptions,
            status: result.status,
        }, operator);
        store_1.dataStore.addAuditLog('calculate_billing', operator, {
            recordId,
            recordNo: record.recordNo,
            result,
        });
        return result;
    }
    calculateAllPending(operator) {
        const pendingRecords = store_1.dataStore
            .getAllRecords()
            .filter(r => r.status === 'pending' && !r.isBilled);
        const results = [];
        for (const record of pendingRecords) {
            const result = this.calculateAndUpdateRecord(record.id, operator);
            if (result) {
                results.push(result);
            }
        }
        return results;
    }
    billRecords(recordIds, operator) {
        const success = [];
        const failed = [];
        for (const recordId of recordIds) {
            const record = store_1.dataStore.getRecordById(recordId);
            if (!record) {
                failed.push(recordId);
                continue;
            }
            if (record.isBilled) {
                failed.push(recordId);
                continue;
            }
            if (record.status !== 'valid') {
                failed.push(recordId);
                continue;
            }
            store_1.dataStore.updateRecord(recordId, {
                isBilled: true,
                billedAt: new Date(),
                billedBy: operator,
                status: 'billed',
            }, operator);
            success.push(recordId);
            store_1.dataStore.addAuditLog('bill_record', operator, {
                recordId,
                recordNo: record.recordNo,
                finalAmount: record.finalAmount,
            });
        }
        return { success, failed };
    }
    billAllValid(operator) {
        const validRecords = store_1.dataStore
            .getAllRecords()
            .filter(r => r.status === 'valid' && !r.isBilled)
            .map(r => r.id);
        return this.billRecords(validRecords, operator);
    }
    reviewRecord(recordId, operator, notes, approve) {
        const record = store_1.dataStore.getRecordById(recordId);
        if (!record)
            return null;
        const updates = {
            reviewNotes: notes,
            reviewedBy: operator,
            reviewedAt: new Date(),
        };
        if (approve) {
            updates.status = 'reviewed';
        }
        else {
            updates.status = 'invalid';
        }
        const updated = store_1.dataStore.updateRecord(recordId, updates, operator);
        store_1.dataStore.addAuditLog('review_record', operator, {
            recordId,
            recordNo: record.recordNo,
            approve,
            notes,
        });
        return updated;
    }
    getBillSummary(filter = {}) {
        let records = store_1.dataStore.getAllRecords();
        if (filter.startDate) {
            records = records.filter(r => r.billedAt && r.billedAt >= filter.startDate);
        }
        if (filter.endDate) {
            records = records.filter(r => r.billedAt && r.billedAt <= filter.endDate);
        }
        if (filter.operator) {
            records = records.filter(r => r.billedBy === filter.operator);
        }
        const billedRecords = records.filter(r => r.isBilled);
        return {
            totalBilled: billedRecords.length,
            totalAmount: billedRecords.reduce((sum, r) => sum + r.finalAmount, 0),
            byOperator: billedRecords.reduce((acc, r) => {
                acc[r.operator] = (acc[r.operator] || 0) + r.finalAmount;
                return acc;
            }, {}),
            byTractor: billedRecords.reduce((acc, r) => {
                acc[r.tractorNo] = (acc[r.tractorNo] || 0) + r.finalAmount;
                return acc;
            }, {}),
        };
    }
    getAuditLogs(filter) {
        return store_1.dataStore.getAuditLogs(filter);
    }
}
exports.BillingService = BillingService;
exports.billingService = new BillingService();
