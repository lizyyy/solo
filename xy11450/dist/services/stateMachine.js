"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachineService = void 0;
const types_1 = require("../types");
const dao_1 = require("../database/dao");
const STATE_TRANSITIONS = {
    UPLOAD_ATTACHMENTS: {
        from: [types_1.ReturnStatus.BATCH_CREATED, types_1.ReturnStatus.ATTACHMENTS_PENDING],
        to: types_1.ReturnStatus.ATTACHMENTS_PENDING,
        description: '上传附件'
    },
    COMPLETE_ATTACHMENTS: {
        from: [types_1.ReturnStatus.ATTACHMENTS_PENDING],
        to: types_1.ReturnStatus.ATTACHMENTS_COMPLETE,
        description: '附件上传完成',
        validate: async (batchId) => {
            const attachments = await dao_1.AttachmentDAO.findByBatchId(batchId);
            const hasRequired = attachments.some(a => a.type === types_1.AttachmentType.OUTBOUND_ORDER) &&
                attachments.some(a => a.type === types_1.AttachmentType.RETURN_PHOTO);
            return hasRequired;
        }
    },
    START_REVIEW: {
        from: [types_1.ReturnStatus.ATTACHMENTS_COMPLETE],
        to: types_1.ReturnStatus.UNDER_REVIEW,
        description: '开始复核'
    },
    APPROVE_REVIEW: {
        from: [types_1.ReturnStatus.UNDER_REVIEW],
        to: types_1.ReturnStatus.REVIEW_APPROVED,
        description: '复核通过',
        validate: async (batchId, context) => {
            const { deductibleAmount, finalRefund } = context || {};
            if (deductibleAmount < 0 || finalRefund < 0) {
                await dao_1.FailedRecordDAO.create({
                    batchId,
                    failureType: 'VALIDATION_ERROR',
                    errorMessage: '扣款金额或退款金额不能为负数',
                    sourceData: { deductibleAmount, finalRefund }
                });
                return false;
            }
            return true;
        }
    },
    REJECT_REVIEW: {
        from: [types_1.ReturnStatus.UNDER_REVIEW],
        to: types_1.ReturnStatus.REVIEW_REJECTED,
        description: '复核驳回'
    },
    RESUBMIT_FOR_REVIEW: {
        from: [types_1.ReturnStatus.REVIEW_REJECTED, types_1.ReturnStatus.ATTACHMENTS_PENDING],
        to: types_1.ReturnStatus.ATTACHMENTS_COMPLETE,
        description: '重新提交复核'
    },
    FREEZE_SETTLEMENT: {
        from: [
            types_1.ReturnStatus.UNDER_REVIEW,
            types_1.ReturnStatus.REVIEW_APPROVED,
            types_1.ReturnStatus.REVIEW_REJECTED,
            types_1.ReturnStatus.ATTACHMENTS_COMPLETE
        ],
        to: types_1.ReturnStatus.SETTLEMENT_FROZEN,
        description: '冻结结算'
    },
    UNFREEZE_SETTLEMENT: {
        from: [types_1.ReturnStatus.SETTLEMENT_FROZEN],
        to: types_1.ReturnStatus.UNDER_REVIEW,
        description: '解冻结算'
    },
    COMPLETE_SETTLEMENT: {
        from: [types_1.ReturnStatus.REVIEW_APPROVED],
        to: types_1.ReturnStatus.SETTLEMENT_COMPLETED,
        description: '结算完成'
    },
    RETURN_TO_CUSTOMER: {
        from: [types_1.ReturnStatus.SETTLEMENT_COMPLETED],
        to: types_1.ReturnStatus.RETURNED,
        description: '退回客户'
    },
    ARCHIVE: {
        from: [
            types_1.ReturnStatus.SETTLEMENT_COMPLETED,
            types_1.ReturnStatus.RETURNED,
            types_1.ReturnStatus.REVIEW_REJECTED
        ],
        to: types_1.ReturnStatus.ARCHIVED,
        description: '撤回归档'
    }
};
class StateMachineService {
    static canTransition(from, transitionKey) {
        const transition = STATE_TRANSITIONS[transitionKey];
        if (!transition)
            return false;
        return transition.from.includes(from);
    }
    static async transition(batchId, transitionKey, reason, operatorId, operatorName, context) {
        const batch = await dao_1.BatchDAO.findById(batchId);
        if (!batch) {
            throw new Error('批次不存在');
        }
        if (batch.isArchived && transitionKey !== 'UNARCHIVE') {
            throw new Error('已归档的批次无法进行状态变更');
        }
        if (batch.status === types_1.ReturnStatus.SETTLEMENT_FROZEN &&
            transitionKey !== 'UNFREEZE_SETTLEMENT' &&
            transitionKey !== 'ARCHIVE') {
            throw new Error('已冻结的批次请先解冻后再操作');
        }
        if (!this.canTransition(batch.status, transitionKey)) {
            throw new Error(`无法从 ${batch.status} 执行 ${transitionKey}`);
        }
        const transition = STATE_TRANSITIONS[transitionKey];
        if (transition.validate) {
            const isValid = await transition.validate(batchId, context);
            if (!isValid) {
                throw new Error(`状态转换验证失败: ${transition.description}`);
            }
        }
        const targetStatus = transitionKey === 'UNFREEZE_SETTLEMENT'
            ? (batch.previousStatus || types_1.ReturnStatus.UNDER_REVIEW)
            : transition.to;
        if (transitionKey === 'FREEZE_SETTLEMENT') {
            await dao_1.BatchDAO.freeze(batchId, reason, operatorId, operatorName);
        }
        else if (transitionKey === 'ARCHIVE') {
            await dao_1.BatchDAO.archive(batchId, reason, operatorId, operatorName);
        }
        else {
            await dao_1.BatchDAO.updateStatus(batchId, targetStatus, reason, operatorId, operatorName);
        }
        if (context?.deductibleAmount !== undefined && context?.finalRefund !== undefined) {
            await dao_1.BatchDAO.updateDeductions(batchId, context.deductibleAmount, context.finalRefund, reason, operatorId, operatorName);
        }
        const updatedBatch = await dao_1.BatchDAO.findById(batchId);
        if (!updatedBatch) {
            throw new Error('批次更新失败');
        }
        return updatedBatch;
    }
    static async createBatch(batchData, equipmentItems, operatorId, operatorName) {
        const existingBatch = await dao_1.BatchDAO.findByBatchNo(batchData.batchNo);
        if (existingBatch) {
            throw new Error('批次号已存在');
        }
        const totalDeposit = equipmentItems.reduce((sum, item) => sum + item.depositAmount, 0);
        const batch = await dao_1.BatchDAO.create({
            ...batchData,
            totalDeposit,
            deductibleAmount: 0,
            finalRefund: totalDeposit,
            status: types_1.ReturnStatus.BATCH_CREATED,
            createdBy: operatorId,
            updatedBy: operatorId
        });
        const itemsWithBatchId = equipmentItems.map(item => ({
            ...item,
            batchId: batch.id
        }));
        const createdItems = await dao_1.EquipmentDAO.create(itemsWithBatchId);
        await dao_1.AuditLogDAO.create({
            batchId: batch.id,
            action: types_1.AuditAction.STATUS_CHANGE,
            previousValue: null,
            newValue: types_1.ReturnStatus.BATCH_CREATED,
            reason: '创建批次',
            operatorId,
            operatorName,
            timestamp: new Date()
        });
        return {
            ...batch,
            equipmentList: createdItems
        };
    }
    static async getBatchDetail(batchId) {
        const batch = await dao_1.BatchDAO.findById(batchId);
        if (!batch)
            return null;
        const [equipmentList, attachments, deductions, auditLogs] = await Promise.all([
            dao_1.EquipmentDAO.findByBatchId(batchId),
            dao_1.AttachmentDAO.findByBatchId(batchId),
            dao_1.DeductionDAO.findByBatchId(batchId),
            dao_1.AuditLogDAO.findByBatchId(batchId)
        ]);
        return {
            ...batch,
            equipmentList,
            attachments,
            deductions,
            auditLogs
        };
    }
    static validateDataConsistency(batch) {
        const errors = [];
        const calculatedDeposit = batch.equipmentList?.reduce((sum, item) => sum + item.depositAmount, 0) || 0;
        if (Math.abs(calculatedDeposit - batch.totalDeposit) > 0.01) {
            errors.push(`押金总额不一致: 设备汇总 ${calculatedDeposit} ≠ 批次总额 ${batch.totalDeposit}`);
        }
        const calculatedDeduction = batch.equipmentList?.reduce((sum, item) => sum + item.deductibleAmount, 0) || 0;
        if (Math.abs(calculatedDeduction - batch.deductibleAmount) > 0.01) {
            errors.push(`扣款总额不一致: 设备汇总 ${calculatedDeduction} ≠ 批次总额 ${batch.deductibleAmount}`);
        }
        const calculatedRefund = batch.totalDeposit - batch.deductibleAmount;
        if (Math.abs(calculatedRefund - batch.finalRefund) > 0.01) {
            errors.push(`退款金额不一致: 计算值 ${calculatedRefund} ≠ 记录值 ${batch.finalRefund}`);
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    static async getAvailableTransitions(status) {
        return Object.entries(STATE_TRANSITIONS)
            .filter(([_, transition]) => transition.from.includes(status))
            .map(([key]) => key);
    }
    static getTransitionDescription(transitionKey) {
        return STATE_TRANSITIONS[transitionKey]?.description || transitionKey;
    }
}
exports.StateMachineService = StateMachineService;
//# sourceMappingURL=stateMachine.js.map