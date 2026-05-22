"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewService = exports.ReviewService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const dataStore_1 = require("../store/dataStore");
const billingCalculatorService_1 = require("./billingCalculatorService");
class ReviewService {
    async approveRecord(recordId, userId, userName, comment) {
        const record = dataStore_1.dataStore.getBillingRecord(recordId);
        if (!record)
            return undefined;
        const reviewNote = {
            id: (0, uuid_1.v4)(),
            userId,
            userName,
            timestamp: new Date(),
            action: 'approve',
            comment,
        };
        const updatedRecord = dataStore_1.dataStore.updateBillingRecord(recordId, {
            reviewStatus: types_1.ReviewStatus.APPROVED,
            reviewNotes: [...record.reviewNotes, reviewNote],
            anomalies: record.anomalies.map(a => ({ ...a, resolved: true })),
        });
        return updatedRecord;
    }
    async rejectRecord(recordId, userId, userName, comment) {
        const record = dataStore_1.dataStore.getBillingRecord(recordId);
        if (!record)
            return undefined;
        const reviewNote = {
            id: (0, uuid_1.v4)(),
            userId,
            userName,
            timestamp: new Date(),
            action: 'reject',
            comment,
        };
        const updatedRecord = dataStore_1.dataStore.updateBillingRecord(recordId, {
            reviewStatus: types_1.ReviewStatus.REJECTED,
            reviewNotes: [...record.reviewNotes, reviewNote],
        });
        return updatedRecord;
    }
    async requestMoreInfo(recordId, userId, userName, comment) {
        const record = dataStore_1.dataStore.getBillingRecord(recordId);
        if (!record)
            return undefined;
        const reviewNote = {
            id: (0, uuid_1.v4)(),
            userId,
            userName,
            timestamp: new Date(),
            action: 'request_info',
            comment,
        };
        const updatedRecord = dataStore_1.dataStore.updateBillingRecord(recordId, {
            reviewStatus: types_1.ReviewStatus.NEEDS_MORE_INFO,
            reviewNotes: [...record.reviewNotes, reviewNote],
        });
        return updatedRecord;
    }
    modifyRecord(recordId, userId, userName, comment, modifications) {
        const record = dataStore_1.dataStore.getBillingRecord(recordId);
        if (!record)
            return undefined;
        const changes = {};
        const allowedFields = [
            'baseConsumption',
            'overtimeConsumption',
            'appliedMultiplier',
            'ratePerKwh',
            'electricityCost',
            'baseRent',
            'overtimeSurcharge',
            'totalAmount',
        ];
        const finalModifications = { ...modifications };
        for (const field of allowedFields) {
            if (field in modifications) {
                const oldValue = record[field];
                const newValue = modifications[field];
                if (oldValue !== newValue) {
                    changes[field] = { old: oldValue, new: newValue };
                }
            }
        }
        const costFieldsChanged = 'electricityCost' in modifications || 'baseRent' in modifications || 'overtimeSurcharge' in modifications;
        if (costFieldsChanged && !('totalAmount' in modifications)) {
            const newElectricityCost = modifications.electricityCost !== undefined ? modifications.electricityCost : record.electricityCost;
            const newBaseRent = modifications.baseRent !== undefined ? modifications.baseRent : record.baseRent;
            const newOvertimeSurcharge = modifications.overtimeSurcharge !== undefined ? modifications.overtimeSurcharge : record.overtimeSurcharge;
            const newTotalAmount = newElectricityCost + newBaseRent + newOvertimeSurcharge;
            finalModifications.totalAmount = newTotalAmount;
            changes['totalAmount'] = {
                old: record.totalAmount,
                new: newTotalAmount,
            };
        }
        if ('anomalies' in modifications && modifications.anomalies) {
            modifications.anomalies.forEach(anomaly => {
                const existingAnomaly = record.anomalies.find(a => a.id === anomaly.id);
                if (existingAnomaly && existingAnomaly.resolved !== anomaly.resolved) {
                    changes[`anomaly_${anomaly.id}`] = {
                        old: existingAnomaly.resolved,
                        new: anomaly.resolved,
                    };
                }
            });
        }
        const reviewNote = {
            id: (0, uuid_1.v4)(),
            userId,
            userName,
            timestamp: new Date(),
            action: 'modify',
            comment,
            changes,
        };
        const updatedRecord = dataStore_1.dataStore.updateBillingRecord(recordId, {
            ...finalModifications,
            reviewNotes: [...record.reviewNotes, reviewNote],
            updatedAt: new Date(),
        });
        return updatedRecord;
    }
    async addComment(recordId, userId, userName, comment) {
        const record = dataStore_1.dataStore.getBillingRecord(recordId);
        if (!record)
            return undefined;
        const reviewNote = {
            id: (0, uuid_1.v4)(),
            userId,
            userName,
            timestamp: new Date(),
            action: 'comment',
            comment,
        };
        const updatedRecord = dataStore_1.dataStore.updateBillingRecord(recordId, {
            reviewNotes: [...record.reviewNotes, reviewNote],
        });
        return updatedRecord;
    }
    recalculateAndReview(recordId, userId, userName, comment) {
        const recalculated = billingCalculatorService_1.billingCalculatorService.recalculateRecord(recordId);
        if (!recalculated)
            return undefined;
        const reviewNote = {
            id: (0, uuid_1.v4)(),
            userId,
            userName,
            timestamp: new Date(),
            action: 'comment',
            comment: `重新计算: ${comment}`,
        };
        return dataStore_1.dataStore.updateBillingRecord(recordId, {
            reviewNotes: [...recalculated.reviewNotes, reviewNote],
        });
    }
    getReviewHistory(recordId) {
        const record = dataStore_1.dataStore.getBillingRecord(recordId);
        return record?.reviewNotes;
    }
    getRecordsByStatus(status) {
        return dataStore_1.dataStore.getAllBillingRecords().filter(r => r.reviewStatus === status);
    }
    getPendingRecords() {
        return this.getRecordsByStatus(types_1.ReviewStatus.PENDING);
    }
    getApprovedRecords() {
        return this.getRecordsByStatus(types_1.ReviewStatus.APPROVED);
    }
    getStatistics() {
        const records = dataStore_1.dataStore.getAllBillingRecords();
        return {
            total: records.length,
            pending: records.filter(r => r.reviewStatus === types_1.ReviewStatus.PENDING).length,
            approved: records.filter(r => r.reviewStatus === types_1.ReviewStatus.APPROVED).length,
            rejected: records.filter(r => r.reviewStatus === types_1.ReviewStatus.REJECTED).length,
            needsMoreInfo: records.filter(r => r.reviewStatus === types_1.ReviewStatus.NEEDS_MORE_INFO).length,
            withAnomalies: records.filter(r => r.anomalies.length > 0).length,
            unresolvedAnomalies: records.filter(r => r.anomalies.some(a => !a.resolved)).length,
        };
    }
}
exports.ReviewService = ReviewService;
exports.reviewService = new ReviewService();
//# sourceMappingURL=reviewService.js.map