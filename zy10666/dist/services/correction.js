"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctionService = void 0;
const types_1 = require("../types");
const memory_1 = require("../storage/memory");
const STATUS_TRANSITIONS = {
    [types_1.CorrectionStatus.CAN_TRY]: [types_1.CorrectionStatus.CORRECTED, types_1.CorrectionStatus.REVOKED],
    [types_1.CorrectionStatus.ABNORMAL_PENDING]: [types_1.CorrectionStatus.CAN_TRY, types_1.CorrectionStatus.CORRECTED, types_1.CorrectionStatus.REVOKED],
    [types_1.CorrectionStatus.CORRECTED]: [types_1.CorrectionStatus.REVOKED],
    [types_1.CorrectionStatus.REVOKED]: []
};
class CorrectionService {
    async createCorrection(params) {
        const conflicts = await memory_1.memoryStorage.findConflicts(params.user.userId, params.video.videoId);
        let status = params.initialStatus || types_1.CorrectionStatus.CAN_TRY;
        let correctionReason = types_1.CorrectionReason.NEW_RULE_APPLIED;
        let readableReason = types_1.CorrectionReasonLabel[types_1.CorrectionReason.NEW_RULE_APPLIED];
        let conflictInfo;
        if (conflicts.length > 0) {
            const conflictSystems = conflicts.map(c => c.sourceSystem);
            const allSystems = [...new Set([...conflictSystems, params.sourceSystem])];
            conflictInfo = {
                hasConflict: true,
                conflictRecords: conflicts.map(c => c.id),
                conflictSystems: allSystems,
                resolutionStrategy: this.getResolutionStrategy(allSystems, params.sourceSystem)
            };
            status = types_1.CorrectionStatus.ABNORMAL_PENDING;
            correctionReason = types_1.CorrectionReason.DUPLICATE_CONFLICT;
            readableReason = `检测到多系统数据冲突: ${allSystems.map(s => s).join(', ')}。${conflictInfo.resolutionStrategy}`;
        }
        if (params.user.isPaid && params.trialRule.ruleVersion.startsWith('v1')) {
            status = types_1.CorrectionStatus.ABNORMAL_PENDING;
            correctionReason = types_1.CorrectionReason.PAID_USER_BLOCKED_BY_OLD_RULE;
            readableReason = `付费用户(${params.user.userName})被旧试看规则(${params.trialRule.ruleName})限制播放，需人工复核处理`;
        }
        if (params.customReason) {
            readableReason = params.customReason;
        }
        const record = await memory_1.memoryStorage.createRecord({
            video: params.video,
            user: params.user,
            trialRule: params.trialRule,
            status,
            correctionReason,
            readableReason,
            sourceSystem: params.sourceSystem,
            sourceRecordId: params.sourceRecordId,
            conflictInfo,
            operatorId: params.operatorId,
            operatorName: params.operatorName
        });
        if (conflicts.length > 0) {
            for (const conflict of conflicts) {
                if (!conflict.conflictInfo?.hasConflict) {
                    await memory_1.memoryStorage.updateRecord(conflict.id, {
                        status: types_1.CorrectionStatus.ABNORMAL_PENDING,
                        correctionReason: types_1.CorrectionReason.DUPLICATE_CONFLICT,
                        readableReason: `检测到新数据冲突(来自${params.sourceSystem})，已标记为异常待判`,
                        conflictInfo: {
                            hasConflict: true,
                            conflictRecords: [...(conflict.conflictInfo?.conflictRecords || []), record.id],
                            conflictSystems: [...new Set([...(conflict.conflictInfo?.conflictSystems || []), params.sourceSystem])],
                            resolutionStrategy: conflictInfo.resolutionStrategy
                        }
                    });
                }
            }
        }
        return {
            success: true,
            record,
            businessCode: status,
            businessMessage: readableReason,
            hasConflict: conflicts.length > 0,
            conflictRecords: conflicts.map(c => c.id)
        };
    }
    async updateStatus(params) {
        const record = await memory_1.memoryStorage.getRecordById(params.recordId);
        if (!record) {
            return {
                success: false,
                businessCode: 'RECORD_NOT_FOUND',
                businessMessage: '纠偏记录不存在'
            };
        }
        const allowedTransitions = STATUS_TRANSITIONS[record.status];
        if (!allowedTransitions.includes(params.newStatus)) {
            return {
                success: false,
                businessCode: 'INVALID_TRANSITION',
                businessMessage: `状态流转无效: 从${record.status}无法流转到${params.newStatus}`
            };
        }
        let newReadableReason = record.readableReason;
        if (params.remark) {
            newReadableReason = `${record.readableReason}。操作备注: ${params.remark}`;
        }
        const updatedRecord = await memory_1.memoryStorage.updateRecord(params.recordId, {
            status: params.newStatus,
            readableReason: newReadableReason,
            operatorId: params.operatorId,
            operatorName: params.operatorName,
            remark: params.remark
        });
        await memory_1.memoryStorage.addHistory({
            recordId: params.recordId,
            oldStatus: record.status,
            newStatus: params.newStatus,
            operatorId: params.operatorId,
            operatorName: params.operatorName,
            operationRemark: params.remark
        });
        return {
            success: true,
            record: updatedRecord,
            businessCode: params.newStatus,
            businessMessage: `状态已更新为${params.newStatus}`
        };
    }
    async getRecordDetail(id) {
        return memory_1.memoryStorage.getRecordById(id);
    }
    getResolutionStrategy(systems, newSystem) {
        const priority = [
            types_1.SourceSystem.ORDER_SYSTEM,
            types_1.SourceSystem.USER_CENTER,
            types_1.SourceSystem.VOD_BACKEND,
            types_1.SourceSystem.CONTENT_MANAGEMENT,
            types_1.SourceSystem.IMPORT_BATCH
        ];
        const highestPriority = systems.reduce((a, b) => priority.indexOf(a) < priority.indexOf(b) ? a : b);
        return `建议以${highestPriority}数据为准，需人工确认后进行纠偏操作`;
    }
    async correctPaidUser(recordId, operatorId, operatorName) {
        const record = await memory_1.memoryStorage.getRecordById(recordId);
        if (!record) {
            return {
                success: false,
                businessCode: 'RECORD_NOT_FOUND',
                businessMessage: '纠偏记录不存在'
            };
        }
        if (record.correctionReason !== types_1.CorrectionReason.PAID_USER_BLOCKED_BY_OLD_RULE) {
            return {
                success: false,
                businessCode: 'INVALID_REASON',
                businessMessage: '该记录不是付费用户被限制的场景'
            };
        }
        return this.updateStatus({
            recordId,
            newStatus: types_1.CorrectionStatus.CORRECTED,
            operatorId,
            operatorName,
            remark: '已解除旧试看规则对付费用户的限制，恢复正常播放权限'
        });
    }
}
exports.correctionService = new CorrectionService();
