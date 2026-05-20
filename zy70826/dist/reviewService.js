"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const types_1 = require("./types");
class ReviewService {
    constructor(initialRecords) {
        this.records = JSON.parse(JSON.stringify(initialRecords));
        this.summary = this.recalculateSummary();
    }
    getRecords() {
        return this.records;
    }
    getSummary() {
        return this.summary;
    }
    getPendingRecords() {
        return this.records.filter(r => r.reviewStatus === types_1.ReviewStatus.PENDING_REVIEW);
    }
    updateRecord(update, reviewer) {
        const recordIndex = this.records.findIndex(r => r.id === update.recordId);
        if (recordIndex === -1) {
            throw new Error(`Record not found: ${update.recordId}`);
        }
        const record = this.records[recordIndex];
        if (update.newStatus) {
            record.currentStatus = update.newStatus;
        }
        if (update.deductionAmount !== undefined) {
            record.deductionAmount = update.deductionAmount;
        }
        if (update.resolveDiscrepancy) {
            record.discrepancies.forEach(d => {
                d.isResolved = true;
                d.resolution = update.reviewNotes || '人工复核后标记为已解决';
            });
        }
        if (update.reviewNotes) {
            record.reviewNotes = update.reviewNotes;
        }
        record.reviewStatus = types_1.ReviewStatus.REVIEWED;
        record.reviewer = reviewer;
        record.reviewTime = new Date().toISOString();
        record.isModified = true;
        if (this.needsManualDiscrepancy(record, update)) {
            record.discrepancies.push({
                id: (0, types_1.generateId)(),
                shipmentId: record.shipmentId,
                type: types_1.DiscrepancyType.MANUAL_CORRECTION,
                description: `人工修正：状态从${record.originalStatus}改为${record.currentStatus}`,
                amount: record.deductionAmount,
                source: `人工操作 - ${reviewer}`,
                isResolved: true
            });
        }
        this.summary = this.recalculateSummary();
        return record;
    }
    batchUpdate(updates, reviewer) {
        return updates.map(update => this.updateRecord(update, reviewer));
    }
    confirmAllReviewed() {
        this.records.forEach(record => {
            if (record.reviewStatus === types_1.ReviewStatus.REVIEWED) {
                record.reviewStatus = types_1.ReviewStatus.CONFIRMED;
            }
        });
        this.summary = this.recalculateSummary();
    }
    needsManualDiscrepancy(record, update) {
        if (record.discrepancies.length === 0 && (update.newStatus || update.deductionAmount !== undefined)) {
            return true;
        }
        return false;
    }
    recalculateSummary() {
        const summary = {
            totalShipments: this.records.length,
            returnedOnTime: 0,
            overdue: 0,
            damaged: 0,
            lost: 0,
            totalDeduction: 0,
            pendingReview: 0,
            reviewed: 0
        };
        this.records.forEach(record => {
            switch (record.currentStatus) {
                case types_1.SampleStatus.RETURNED:
                    summary.returnedOnTime++;
                    break;
                case types_1.SampleStatus.OVERDUE:
                    summary.overdue++;
                    break;
                case types_1.SampleStatus.DAMAGED:
                    summary.damaged++;
                    break;
                case types_1.SampleStatus.LOST:
                    summary.lost++;
                    break;
            }
            summary.totalDeduction += record.deductionAmount;
            if (record.reviewStatus === types_1.ReviewStatus.PENDING_REVIEW) {
                summary.pendingReview++;
            }
            else {
                summary.reviewed++;
            }
        });
        return summary;
    }
    getDiscrepancies() {
        return this.records.flatMap(r => r.discrepancies);
    }
    getModifiedRecords() {
        return this.records.filter(r => r.isModified);
    }
}
exports.ReviewService = ReviewService;
