import { v4 as uuidv4 } from 'uuid';
import {
  DepositDeduction,
  DepositDeductionStatus,
  DepositDeductionItem,
  DeductionType,
  ApiResponse
} from '../types';
import { db } from '../store/database';
import { stateMachine, StateTransitionError } from './state-machine.service';
import { conflictDetector } from './conflict-detector.service';
import { SUBMIT_SOURCES } from '../config/constants';

export interface CreateDeductionRequest {
  orderNo: string;
  deductionType: DeductionType;
  items: Omit<DepositDeductionItem, 'id'>[];
  applicantId: string;
  applicantName: string;
  submitSource: string;
  remark?: string;
}

export interface ActionRequest {
  deductionId: string;
  action: string;
  operatorId: string;
  operatorName: string;
  submitSource: string;
  remark?: string;
}

class DeductionService {
  async createDeduction(request: CreateDeductionRequest): Promise<ApiResponse<DepositDeduction>> {
    try {
      const order = db.getOrderByNo(request.orderNo);
      if (!order) {
        return {
          success: false,
          message: `订单 ${request.orderNo} 不存在`,
          errorCode: 'ORDER_NOT_FOUND'
        };
      }

      if (!Object.values(SUBMIT_SOURCES).includes(request.submitSource)) {
        return {
          success: false,
          message: '无效的提交来源',
          errorCode: 'INVALID_SUBMIT_SOURCE'
        };
      }

      const items: DepositDeductionItem[] = request.items.map(item => ({
        ...item,
        id: uuidv4()
      }));

      const totalDeductionAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);

      const deduction = db.addDeduction({
        deductionNo: db.generateDeductionNo(),
        orderId: order.id,
        orderNo: order.orderNo,
        guestName: order.guestName,
        guestPhone: order.guestPhone,
        roomNo: order.roomNo,
        deductionType: request.deductionType,
        status: DepositDeductionStatus.DRAFT,
        totalDeductionAmount,
        items,
        applicantId: request.applicantId,
        applicantName: request.applicantName,
        submitSource: request.submitSource,
        applyTime: new Date(),
        remark: request.remark
      });

      db.addAuditLog({
        deductionId: deduction.id,
        action: 'CREATE',
        fromStatus: undefined,
        toStatus: DepositDeductionStatus.DRAFT,
        operatorId: request.applicantId,
        operatorName: request.applicantName,
        submitSource: request.submitSource,
        remark: '创建押金扣项申请'
      });

      return {
        success: true,
        data: deduction,
        message: '押金扣项申请创建成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '创建失败',
        errorCode: 'CREATE_ERROR'
      };
    }
  }

  async performAction(request: ActionRequest): Promise<ApiResponse<DepositDeduction>> {
    try {
      const deduction = db.getDeductionById(request.deductionId);
      if (!deduction) {
        return {
          success: false,
          message: '押金扣项申请不存在',
          errorCode: 'DEDUCTION_NOT_FOUND'
        };
      }

      const transition = stateMachine.validateTransition(
        deduction.status,
        request.action,
        request.operatorId
      );

      const order = db.getOrderById(deduction.orderId);
      if (!order) {
        return {
          success: false,
          message: '关联订单不存在',
          errorCode: 'ORDER_NOT_FOUND'
        };
      }

      if (request.action === 'SUBMIT' || request.action === 'RESUBMIT') {
        const conflictResult = conflictDetector.checkAllConflicts(deduction, order);
        if (conflictResult.hasConflict) {
          db.updateDeduction(deduction.id, {
            conflictDetected: true,
            conflictDetails: conflictResult.conflictDetails
          });

          return {
            success: false,
            message: conflictResult.conflictDetails || '检测到冲突',
            errorCode: 'CONFLICT_DETECTED',
            data: {
              ...deduction,
              conflictDetected: true,
              conflictDetails: conflictResult.conflictDetails
            }
          };
        }
      }

      const fromStatus = deduction.status;
      const toStatus = transition.to;

      const updates: Partial<DepositDeduction> = {
        status: toStatus,
        conflictDetected: false,
        conflictDetails: undefined
      };

      if (request.action === 'APPROVE' || request.action === 'REJECT') {
        updates.reviewerId = request.operatorId;
        updates.reviewerName = request.operatorName;
        updates.reviewTime = new Date();
        updates.reviewRemark = request.remark;
      }

      if (request.action === 'EXECUTE') {
        updates.executorId = request.operatorId;
        updates.executorName = request.operatorName;
        updates.executeTime = new Date();

        db.updateOrder(order.id, {
          usedDepositAmount: order.usedDepositAmount + deduction.totalDeductionAmount
        });
      }

      const updatedDeduction = db.updateDeduction(deduction.id, updates);

      db.addAuditLog({
        deductionId: deduction.id,
        action: request.action,
        fromStatus,
        toStatus,
        operatorId: request.operatorId,
        operatorName: request.operatorName,
        submitSource: request.submitSource,
        remark: request.remark || transition.description
      });

      return {
        success: true,
        data: updatedDeduction!,
        message: `${transition.description}成功`
      };
    } catch (error) {
      if (error instanceof StateTransitionError) {
        return {
          success: false,
          message: error.message,
          errorCode: error.errorCode
        };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : '操作失败',
        errorCode: 'ACTION_ERROR'
      };
    }
  }

  getDeduction(id: string): ApiResponse<DepositDeduction> {
    const deduction = db.getDeductionById(id);
    if (!deduction) {
      return {
        success: false,
        message: '押金扣项申请不存在',
        errorCode: 'DEDUCTION_NOT_FOUND'
      };
    }

    return {
      success: true,
      data: deduction,
      message: '查询成功'
    };
  }

  getDeductions(orderId?: string): ApiResponse<DepositDeduction[]> {
    let deductions = db.getDeductions();
    if (orderId) {
      deductions = deductions.filter(d => d.orderId === orderId);
    }

    return {
      success: true,
      data: deductions,
      message: '查询成功'
    };
  }

  getAuditLogs(deductionId: string): ApiResponse {
    const logs = db.getAuditLogs(deductionId);
    return {
      success: true,
      data: logs,
      message: '查询成功'
    };
  }

  getAvailableActions(deductionId: string, role: string): ApiResponse {
    const deduction = db.getDeductionById(deductionId);
    if (!deduction) {
      return {
        success: false,
        message: '押金扣项申请不存在',
        errorCode: 'DEDUCTION_NOT_FOUND'
      };
    }

    const actions = stateMachine.getAvailableActions(deduction.status, role);
    return {
      success: true,
      data: actions,
      message: '查询成功'
    };
  }
}

export const deductionService = new DeductionService();