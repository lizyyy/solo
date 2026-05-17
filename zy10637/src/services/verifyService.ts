import { db } from '../store/database';
import { RedApplyStatus, OperationSource, ErrorType, ApiResponse } from '../types';

export class VerifyService {
  verifyConflictCheck(redApplyId: string): { hasConflict: boolean; conflictType?: ErrorType; message?: string } {
    const apply = db.getRedApply(redApplyId);
    if (!apply) {
      return { hasConflict: true, conflictType: ErrorType.DATA_INCOMPLETE, message: '记录不存在' };
    }

    if (apply.order.isPartialRefund) {
      const refundRatio = apply.order.refundAmount / apply.order.orderAmount;
      const invoiceAmount = apply.invoice.totalAmount;
      const orderAmount = apply.order.orderAmount;

      if (refundRatio < 1 && invoiceAmount >= orderAmount) {
        return {
          hasConflict: true,
          conflictType: ErrorType.CONFLICT_REFUND,
          message: `订单${apply.order.orderNo}存在部分退款(退款金额:${apply.order.refundAmount})，申请全额红冲存在风险`
        };
      }
    }

    return { hasConflict: false };
  }

  async startVerify(
    redApplyId: string,
    operator: string,
    source: OperationSource = OperationSource.MANUAL
  ): Promise<ApiResponse> {
    const apply = db.getRedApply(redApplyId);
    if (!apply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '红冲申请记录不存在',
          type: ErrorType.DATA_INCOMPLETE,
          suggestion: '请检查记录ID是否正确，或重新导入'
        }
      };
    }

    if (apply.status !== RedApplyStatus.PENDING_APPLY) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `当前状态${apply.status}不允许开始核验`,
          type: ErrorType.BUSINESS_RULE_VIOLATION,
          suggestion: '请确认记录处于待申请状态'
        }
      };
    }

    const conflict = this.verifyConflictCheck(redApplyId);
    if (conflict.hasConflict) {
      return {
        success: false,
        error: {
          code: 'CONFLICT_DETECTED',
          message: conflict.message!,
          type: conflict.conflictType!,
          suggestion: conflict.conflictType === ErrorType.CONFLICT_REFUND
            ? '请与业务人员确认是否继续操作，或调整红冲金额'
            : '需人工介入处理'
        }
      };
    }

    const updatedApply = db.updateRedApply(redApplyId, {
      status: RedApplyStatus.VERIFYING
    });

    db.addHistoryRecord({
      redApplyId,
      operationSource: source,
      operator,
      operationType: '开始核验',
      fromStatus: RedApplyStatus.PENDING_APPLY,
      toStatus: RedApplyStatus.VERIFYING,
      remark: '核验流程已启动'
    });

    return { success: true, data: updatedApply };
  }

  async approveRedApply(
    redApplyId: string,
    operator: string,
    source: OperationSource = OperationSource.MANUAL
  ): Promise<ApiResponse> {
    const apply = db.getRedApply(redApplyId);
    if (!apply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '红冲申请记录不存在',
          type: ErrorType.DATA_INCOMPLETE,
          suggestion: '请检查记录ID是否正确'
        }
      };
    }

    if (apply.status !== RedApplyStatus.VERIFYING) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `当前状态${apply.status}不允许完成红冲`,
          type: ErrorType.BUSINESS_RULE_VIOLATION,
          suggestion: '请确认记录处于核验中状态'
        }
      };
    }

    const updatedApply = db.updateRedApply(redApplyId, {
      status: RedApplyStatus.RED_COMPLETED
    });

    db.addHistoryRecord({
      redApplyId,
      operationSource: source,
      operator,
      operationType: '核验通过-完成红冲',
      fromStatus: RedApplyStatus.VERIFYING,
      toStatus: RedApplyStatus.RED_COMPLETED,
      remark: '核验通过，红冲流程完成'
    });

    return { success: true, data: updatedApply };
  }

  async rejectRedApply(
    redApplyId: string,
    rejectReason: string,
    operator: string,
    source: OperationSource = OperationSource.MANUAL
  ): Promise<ApiResponse> {
    const apply = db.getRedApply(redApplyId);
    if (!apply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '红冲申请记录不存在',
          type: ErrorType.DATA_INCOMPLETE,
          suggestion: '请检查记录ID是否正确'
        }
      };
    }

    const fromStatus = apply.status;
    const updatedApply = db.updateRedApply(redApplyId, {
      status: RedApplyStatus.REJECTED,
      rejectReason
    });

    db.addHistoryRecord({
      redApplyId,
      operationSource: source,
      operator,
      operationType: '驳回申请',
      fromStatus,
      toStatus: RedApplyStatus.REJECTED,
      remark: `驳回原因: ${rejectReason}`,
      changes: { rejectReason }
    });

    return { success: true, data: updatedApply };
  }

  async forceVerify(
    redApplyId: string,
    operator: string,
    remark: string,
    source: OperationSource = OperationSource.MANUAL
  ): Promise<ApiResponse> {
    const apply = db.getRedApply(redApplyId);
    if (!apply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '红冲申请记录不存在',
          type: ErrorType.DATA_INCOMPLETE,
          suggestion: '请检查记录ID是否正确'
        }
      };
    }

    const conflict = this.verifyConflictCheck(redApplyId);
    const fromStatus = apply.status;
    const updatedApply = db.updateRedApply(redApplyId, {
      status: RedApplyStatus.VERIFYING,
      errorType: conflict.conflictType
    });

    db.addHistoryRecord({
      redApplyId,
      operationSource: source,
      operator,
      operationType: '人工强制核验',
      fromStatus,
      toStatus: RedApplyStatus.VERIFYING,
      remark: `人工介入处理: ${remark}`,
      changes: { forceVerified: true, conflictNote: conflict.message }
    });

    return { success: true, data: updatedApply };
  }
}

export const verifyService = new VerifyService();
