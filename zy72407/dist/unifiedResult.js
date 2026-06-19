"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedStore = exports.UnifiedResultStore = void 0;
const types_1 = require("./types");
const selfCheck_1 = require("./selfCheck");
class UnifiedResultStore {
    constructor() {
        this.records = [];
        this.batches = [];
    }
    reset() {
        this.records = [];
        this.batches = [];
    }
    setRecords(records) {
        this.records = JSON.parse(JSON.stringify(records));
    }
    getRecords() {
        return JSON.parse(JSON.stringify(this.records));
    }
    setBatches(batches) {
        this.batches = JSON.parse(JSON.stringify(batches));
    }
    getBatches() {
        return JSON.parse(JSON.stringify(this.batches));
    }
    addBatch(batch) {
        this.batches.push(JSON.parse(JSON.stringify(batch)));
    }
    updateRecord(id, updates) {
        const index = this.records.findIndex(r => r.id === id);
        if (index !== -1) {
            this.records[index] = {
                ...this.records[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
        }
    }
    generateUnifiedResult() {
        const records = this.getRecords();
        const selfCheck = (0, selfCheck_1.runSelfCheck)(records, this.batches);
        const byStatus = {};
        const byReviewFlag = {};
        Object.values(types_1.RecordStatus).forEach(status => {
            byStatus[status] = 0;
        });
        Object.values(types_1.ReviewFlag).forEach(flag => {
            byReviewFlag[flag] = 0;
        });
        let totalDurationMinutes = 0;
        let totalSettlementAmount = 0;
        records.forEach(record => {
            byStatus[record.status] = (byStatus[record.status] || 0) + 1;
            byReviewFlag[record.reviewFlag] = (byReviewFlag[record.reviewFlag] || 0) + 1;
            totalDurationMinutes += record.durationMinutes || 0;
            totalSettlementAmount += record.settlementAmount || 0;
        });
        return {
            records,
            summary: {
                total: records.length,
                byStatus,
                byReviewFlag,
                totalDurationMinutes,
                totalSettlementAmount
            },
            selfCheck,
            generatedAt: new Date().toISOString(),
            batchIds: this.batches.map(b => b.id)
        };
    }
    getForPageDisplay() {
        return this.generateUnifiedResult();
    }
    getForExport() {
        const result = this.generateUnifiedResult();
        return result.records.map(record => ({
            id: record.id,
            studentName: record.studentName,
            courseDate: record.courseDate,
            courseTime: record.courseTime,
            teacherName: record.teacherName,
            courseType: record.courseType,
            durationMinutes: record.durationMinutes,
            isOnSite: record.isOnSite,
            status: record.status,
            reviewFlag: record.reviewFlag,
            settlementAmount: record.settlementAmount,
            importSource: record.importSource || '',
            importBatchLabel: record.importBatchLabel || '',
            tunerOriginalLineNumber: record.tunerOriginalLineNumber ?? '',
            tunerRawContent: record.tunerRawContent ?? '',
            groupOriginalLineNumber: record.groupOriginalLineNumber ?? '',
            groupRawContent: record.groupRawContent ?? '',
            groupCourseTime: record.groupCourseTime ?? '',
            manualEditsCount: record.manualEdits.length,
            manualEditsDetail: record.manualEdits.map(e => ({
                timestamp: e.timestamp,
                operator: e.operator,
                action: e.action,
                field: e.fieldName ?? '',
                oldValue: e.oldValue ?? '',
                newValue: e.newValue ?? '',
                reason: e.reason ?? ''
            })),
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            settledAt: record.settledAt ?? ''
        }));
    }
    getForApiResponse() {
        return this.generateUnifiedResult();
    }
    getRecordEvidence(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record)
            return null;
        return {
            record,
            evidence: {
                tunerMessage: record.tunerMessageId ? {
                    id: record.tunerMessageId,
                    originalLineNumber: record.tunerOriginalLineNumber,
                    rawContent: record.tunerRawContent,
                    courseTime: record.courseTime
                } : null,
                groupSignup: record.groupSignupId ? {
                    id: record.groupSignupId,
                    originalLineNumber: record.groupOriginalLineNumber,
                    rawContent: record.groupRawContent,
                    courseTime: record.groupCourseTime
                } : null,
                isMismatch: !!(record.groupCourseTime && record.courseTime && record.groupCourseTime !== record.courseTime),
                mismatchDetail: (record.groupCourseTime && record.courseTime && record.groupCourseTime !== record.courseTime)
                    ? `调音师留言记录${record.courseTime}，群接龙记录${record.groupCourseTime}`
                    : null,
                isTempSubOnlyInGroup: record.reviewFlag === types_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP,
                manualEdits: record.manualEdits,
                importSource: record.importSource,
                importBatchLabel: record.importBatchLabel
            }
        };
    }
}
exports.UnifiedResultStore = UnifiedResultStore;
exports.unifiedStore = new UnifiedResultStore();
//# sourceMappingURL=unifiedResult.js.map