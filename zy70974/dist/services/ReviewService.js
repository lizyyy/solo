"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class ReviewService {
    createAuditLog(reconciliationId, action, operator, previousValue, newValue, reason) {
        return {
            id: (0, uuid_1.v4)(),
            reconciliationId,
            action,
            previousValue,
            newValue,
            operator,
            timestamp: new Date(),
            reason,
        };
    }
    createManualDiscrepancy(description, recordId, fieldName, oldValue, newValue) {
        return {
            id: (0, uuid_1.v4)(),
            type: types_1.DiscrepancyType.MANUAL_CHANGE,
            description,
            severity: 'medium',
            relatedRecordIds: [recordId],
            sourceEvidence: [
                {
                    source: types_1.DataSource.MANUAL,
                    field: fieldName,
                    expectedValue: oldValue,
                    actualValue: newValue,
                },
            ],
        };
    }
    processReviewAction(record, action) {
        const auditLogs = [...record.auditTrail];
        const updatedRecord = { ...record };
        let discrepancies = [...record.discrepancies];
        auditLogs.push(this.createAuditLog(record.id, `review_${action.action}`, action.operator, record.reviewStatus, action.action, action.reason));
        switch (action.action) {
            case 'approve':
                updatedRecord.reviewStatus = types_1.ReviewStatus.APPROVED;
                updatedRecord.finalStatus = 'allowed';
                updatedRecord.finalReason = action.reason || '审核通过，数据一致';
                break;
            case 'reject':
                updatedRecord.reviewStatus = types_1.ReviewStatus.REJECTED;
                updatedRecord.finalStatus = 'rejected';
                updatedRecord.finalReason = action.reason || '审核拒绝，数据存在问题';
                break;
            case 'request_info':
                updatedRecord.reviewStatus = types_1.ReviewStatus.NEEDS_MORE_INFO;
                updatedRecord.finalStatus = 'pending';
                updatedRecord.finalReason = action.reason || '需要补充材料';
                break;
        }
        if (action.updateFields) {
            for (const [field, value] of Object.entries(action.updateFields)) {
                const oldValue = record[field];
                if (oldValue !== value) {
                    auditLogs.push(this.createAuditLog(record.id, `field_update`, action.operator, oldValue, value, `手动更新字段: ${field}`));
                    const fieldLabels = {
                        name: '姓名',
                        phone: '电话',
                        checkInStatus: '签到状态',
                        registrationStatus: '报名状态',
                        activityName: '活动名称',
                    };
                    discrepancies.push(this.createManualDiscrepancy(`手动修改${fieldLabels[field] || field}：从 "${oldValue}" 改为 "${value}"`, record.id, field, String(oldValue), String(value)));
                    updatedRecord[field] = value;
                }
            }
        }
        updatedRecord.discrepancies = discrepancies;
        updatedRecord.auditTrail = auditLogs;
        updatedRecord.updatedAt = new Date();
        return updatedRecord;
    }
    batchReview(records, recordIds, action) {
        return records.map((record) => {
            if (recordIds.includes(record.id)) {
                return this.processReviewAction(record, { ...action, recordId: record.id });
            }
            return record;
        });
    }
    getAuditTrail(record) {
        return record.auditTrail.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    explainFinalStatus(record) {
        const statusMap = {
            allowed: '放行',
            rejected: '退回',
            pending: '待处理',
        };
        const evidence = [];
        record.discrepancies.forEach((d) => {
            const typeLabels = {
                [types_1.DiscrepancyType.DUPLICATE_REGISTRATION]: '重复报名',
                [types_1.DiscrepancyType.BLACKLISTED]: '黑名单人员',
                [types_1.DiscrepancyType.WAITLIST_PROMOTED]: '候补递补',
                [types_1.DiscrepancyType.CANCELLED_BUT_CHECKED_IN]: '取消后签到',
                [types_1.DiscrepancyType.NOT_REGISTERED_BUT_CHECKED_IN]: '无报名但签到',
                [types_1.DiscrepancyType.REGISTERED_BUT_NOT_CHECKED_IN]: '报名未签到',
                [types_1.DiscrepancyType.INFO_MISMATCH]: '信息不一致',
                [types_1.DiscrepancyType.MANUAL_CHANGE]: '人工修改',
            };
            const sources = d.sourceEvidence
                .map((e) => {
                const sourceLabels = {
                    [types_1.DataSource.REGISTRATION_CSV]: '报名表',
                    [types_1.DataSource.WAITLIST_JSON]: '候补表',
                    [types_1.DataSource.CHECKIN_CSV]: '签到表',
                    [types_1.DataSource.BLACKLIST_JSON]: '黑名单',
                    [types_1.DataSource.MANUAL]: '人工操作',
                };
                return sourceLabels[e.source] || e.source;
            })
                .join('、');
            evidence.push(`[${typeLabels[d.type]}] ${d.description} (来源: ${sources})`);
        });
        const reviewLog = record.auditTrail.filter((log) => log.action.startsWith('review_'));
        if (reviewLog.length > 0) {
            const lastReview = reviewLog[reviewLog.length - 1];
            evidence.push(`[审核记录] 操作员"${lastReview.operator}"于${lastReview.timestamp.toLocaleString()}处理：${lastReview.reason}`);
        }
        return {
            status: statusMap[record.finalStatus] || record.finalStatus,
            reason: record.finalReason || '未设置原因',
            evidence,
        };
    }
    traceCheckInSource(record) {
        const relatedRecords = [];
        if (record.registrationId) {
            relatedRecords.push({
                type: '报名记录',
                id: record.registrationId,
                status: record.registrationStatus || '未知',
            });
        }
        if (record.waitlistId) {
            relatedRecords.push({
                type: '候补记录',
                id: record.waitlistId,
                status: '候补',
            });
        }
        if (record.checkInId) {
            relatedRecords.push({
                type: '签到记录',
                id: record.checkInId,
                status: record.checkInStatus,
            });
        }
        let checkInSource = '无签到记录';
        if (record.checkInId && record.checkInRowNumber !== undefined) {
            checkInSource = `签到表第 ${record.checkInRowNumber} 行导入`;
        }
        else if (record.checkInId) {
            checkInSource = '签到表导入';
        }
        return {
            hasCheckIn: record.checkInId !== undefined,
            checkInTime: record.checkInTime,
            checkInRowNumber: record.checkInRowNumber,
            checkInSource,
            checkInOriginalData: record.checkInOriginalData,
            relatedRecords,
        };
    }
}
exports.ReviewService = ReviewService;
