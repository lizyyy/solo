import { ReturnStatus, ReturnBatch, AttachmentType, AuditAction } from '../types';
import { BatchDAO, AttachmentDAO, EquipmentDAO, DeductionDAO, AuditLogDAO, FailedRecordDAO } from '../database/dao';

interface StateTransition {
  from: ReturnStatus[];
  to: ReturnStatus;
  description: string;
  validate?: (batchId: string, context?: any) => Promise<boolean>;
}

const STATE_TRANSITIONS: Record<string, StateTransition> = {
  UPLOAD_ATTACHMENTS: {
    from: [ReturnStatus.BATCH_CREATED, ReturnStatus.ATTACHMENTS_PENDING],
    to: ReturnStatus.ATTACHMENTS_PENDING,
    description: '上传附件'
  },
  COMPLETE_ATTACHMENTS: {
    from: [ReturnStatus.BATCH_CREATED, ReturnStatus.ATTACHMENTS_PENDING],
    to: ReturnStatus.ATTACHMENTS_COMPLETE,
    description: '附件上传完成',
    validate: async (batchId: string) => {
      const attachments = await AttachmentDAO.findByBatchId(batchId);
      const hasRequired = attachments.some(a => a.type === AttachmentType.OUTBOUND_ORDER) &&
                         attachments.some(a => a.type === AttachmentType.RETURN_PHOTO);
      return hasRequired;
    }
  },
  START_REVIEW: {
    from: [ReturnStatus.ATTACHMENTS_COMPLETE],
    to: ReturnStatus.UNDER_REVIEW,
    description: '开始复核'
  },
  APPROVE_REVIEW: {
    from: [ReturnStatus.UNDER_REVIEW],
    to: ReturnStatus.REVIEW_APPROVED,
    description: '复核通过',
    validate: async (batchId: string, context?: any) => {
      const { deductibleAmount, finalRefund } = context || {};
      if (deductibleAmount < 0 || finalRefund < 0) {
        await FailedRecordDAO.create({
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
    from: [ReturnStatus.UNDER_REVIEW],
    to: ReturnStatus.REVIEW_REJECTED,
    description: '复核驳回'
  },
  RESUBMIT_FOR_REVIEW: {
    from: [ReturnStatus.REVIEW_REJECTED, ReturnStatus.ATTACHMENTS_PENDING],
    to: ReturnStatus.ATTACHMENTS_COMPLETE,
    description: '重新提交复核'
  },
  FREEZE_SETTLEMENT: {
    from: [
      ReturnStatus.UNDER_REVIEW,
      ReturnStatus.REVIEW_APPROVED,
      ReturnStatus.REVIEW_REJECTED,
      ReturnStatus.ATTACHMENTS_COMPLETE
    ],
    to: ReturnStatus.SETTLEMENT_FROZEN,
    description: '冻结结算'
  },
  UNFREEZE_SETTLEMENT: {
    from: [ReturnStatus.SETTLEMENT_FROZEN],
    to: ReturnStatus.UNDER_REVIEW,
    description: '解冻结算'
  },
  COMPLETE_SETTLEMENT: {
    from: [ReturnStatus.REVIEW_APPROVED],
    to: ReturnStatus.SETTLEMENT_COMPLETED,
    description: '结算完成'
  },
  RETURN_TO_CUSTOMER: {
    from: [ReturnStatus.SETTLEMENT_COMPLETED],
    to: ReturnStatus.RETURNED,
    description: '退回客户'
  },
  ARCHIVE: {
    from: [
      ReturnStatus.SETTLEMENT_COMPLETED,
      ReturnStatus.RETURNED,
      ReturnStatus.REVIEW_REJECTED
    ],
    to: ReturnStatus.ARCHIVED,
    description: '撤回归档'
  }
};

export class StateMachineService {
  private static canTransition(from: ReturnStatus, transitionKey: string): boolean {
    const transition = STATE_TRANSITIONS[transitionKey];
    if (!transition) return false;
    return transition.from.includes(from);
  }

  static async transition(
    batchId: string,
    transitionKey: string,
    reason: string,
    operatorId: string,
    operatorName: string,
    context?: any
  ): Promise<ReturnBatch> {
    const batch = await BatchDAO.findById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.isArchived && transitionKey !== 'UNARCHIVE') {
      throw new Error('已归档的批次无法进行状态变更');
    }

    if (batch.status === ReturnStatus.SETTLEMENT_FROZEN && 
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
      ? (batch.previousStatus || ReturnStatus.UNDER_REVIEW)
      : transition.to;

    if (transitionKey === 'FREEZE_SETTLEMENT') {
      await BatchDAO.freeze(batchId, reason, operatorId, operatorName);
    } else if (transitionKey === 'ARCHIVE') {
      await BatchDAO.archive(batchId, reason, operatorId, operatorName);
    } else {
      await BatchDAO.updateStatus(batchId, targetStatus, reason, operatorId, operatorName);
    }

    if (context?.deductibleAmount !== undefined && context?.finalRefund !== undefined) {
      await BatchDAO.updateDeductions(
        batchId,
        context.deductibleAmount,
        context.finalRefund,
        reason,
        operatorId,
        operatorName
      );
    }

    const updatedBatch = await BatchDAO.findById(batchId);
    if (!updatedBatch) {
      throw new Error('批次更新失败');
    }

    return updatedBatch;
  }

  static async createBatch(
    batchData: Omit<ReturnBatch, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'isArchived' | 'equipmentList'>,
    equipmentItems: Omit<import('../types').EquipmentItem, 'id' | 'batchId' | 'createdAt' | 'updatedAt'>[],
    operatorId: string,
    operatorName: string
  ): Promise<ReturnBatch> {
    const existingBatch = await BatchDAO.findByBatchNo(batchData.batchNo);
    if (existingBatch) {
      throw new Error('批次号已存在');
    }

    const totalDeposit = equipmentItems.reduce((sum, item) => sum + item.depositAmount, 0);

    const batch = await BatchDAO.create({
      ...batchData,
      totalDeposit,
      deductibleAmount: 0,
      finalRefund: totalDeposit,
      status: ReturnStatus.BATCH_CREATED,
      createdBy: operatorId,
      updatedBy: operatorId
    });

    const itemsWithBatchId = equipmentItems.map(item => ({
      ...item,
      batchId: batch.id
    }));
    const createdItems = await EquipmentDAO.create(itemsWithBatchId);

    await AuditLogDAO.create({
      batchId: batch.id,
      action: AuditAction.STATUS_CHANGE,
      previousValue: null,
      newValue: ReturnStatus.BATCH_CREATED,
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

  static async getBatchDetail(batchId: string): Promise<ReturnBatch | null> {
    const batch = await BatchDAO.findById(batchId);
    if (!batch) return null;

    const [equipmentList, attachments, deductions, auditLogs] = await Promise.all([
      EquipmentDAO.findByBatchId(batchId),
      AttachmentDAO.findByBatchId(batchId),
      DeductionDAO.findByBatchId(batchId),
      AuditLogDAO.findByBatchId(batchId)
    ]);

    return {
      ...batch,
      equipmentList,
      attachments,
      deductions,
      auditLogs
    } as any;
  }

  static validateDataConsistency(batch: ReturnBatch): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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

  static async getAvailableTransitions(status: ReturnStatus): Promise<string[]> {
    return Object.entries(STATE_TRANSITIONS)
      .filter(([_, transition]) => transition.from.includes(status))
      .map(([key]) => key);
  }

  static getTransitionDescription(transitionKey: string): string {
    return STATE_TRANSITIONS[transitionKey]?.description || transitionKey;
  }
}
