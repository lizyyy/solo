import { DeductionModel } from '../models/DeductionModel';
import { CleaningTaskModel } from '../models/CleaningTaskModel';
import { UserModel } from '../models/UserModel';
import { Deduction, DeductionType } from '../types';
import { now } from '../models/database';

export interface CreateDeductionRequest {
  taskId: string;
  type: DeductionType;
  amount: number;
  reason: string;
  operatorId: string;
  relatedId?: string;
  relatedType?: string;
  autoConfirm?: boolean;
}

export interface CreateDeductionResult {
  success: boolean;
  deduction?: Deduction;
  error?: string;
  isDuplicate: boolean;
}

export class DeductionService {
  static async createDeduction(request: CreateDeductionRequest): Promise<CreateDeductionResult> {
    const task = CleaningTaskModel.getById(request.taskId);
    if (!task) {
      return { success: false, error: '任务不存在', isDuplicate: false };
    }

    const operator = UserModel.getById(request.operatorId);
    if (!operator || !operator.isActive) {
      return { success: false, error: '操作员不存在或无效', isDuplicate: false };
    }

    const existingDeductions = DeductionModel.getByTaskId(request.taskId);
    const duplicateDeduction = existingDeductions.find(d => 
      d.type === request.type && 
      d.relatedId === request.relatedId &&
      !d.settlementId
    );
    
    if (duplicateDeduction) {
      return { success: true, deduction: duplicateDeduction, isDuplicate: true };
    }

    const deduction = DeductionModel.create({
      taskId: request.taskId,
      orderId: task.orderId,
      type: request.type,
      amount: request.amount,
      reason: request.reason,
      operatorId: request.operatorId,
      operatorName: operator.name,
      relatedId: request.relatedId,
      relatedType: request.relatedType
    });

    if (request.autoConfirm) {
      DeductionModel.confirm(deduction.id);
    }

    return { success: true, deduction: DeductionModel.getById(deduction.id)!, isDuplicate: false };
  }

  static async confirmDeduction(deductionId: string, operatorId: string): Promise<{ success: boolean; deduction?: Deduction; error?: string }> {
    const deduction = DeductionModel.getById(deductionId);
    if (!deduction) {
      return { success: false, error: '扣款记录不存在' };
    }

    if (deduction.isConfirmed) {
      return { success: true, deduction, error: '扣款已确认' };
    }

    DeductionModel.confirm(deductionId);

    return { success: true, deduction: DeductionModel.getById(deductionId)! };
  }

  static async appealDeduction(deductionId: string, reason: string): Promise<{ success: boolean; deduction?: Deduction; error?: string }> {
    const deduction = DeductionModel.getById(deductionId);
    if (!deduction) {
      return { success: false, error: '扣款记录不存在' };
    }

    DeductionModel.update(deductionId, {
      isAppealed: true,
      appealReason: reason
    });

    return { success: true, deduction: DeductionModel.getById(deductionId)! };
  }

  static getDeduction(deductionId: string): Deduction | null {
    return DeductionModel.getById(deductionId);
  }

  static getDeductionsByTask(taskId: string): Deduction[] {
    return DeductionModel.getByTaskId(taskId);
  }

  static getDeductionsBySettlement(settlementId: string): Deduction[] {
    return DeductionModel.getBySettlementId(settlementId);
  }

  static listDeductions(filters: {
    taskId?: string;
    settlementId?: string;
    type?: DeductionType;
    isConfirmed?: boolean;
  } = {}): Deduction[] {
    return DeductionModel.list(filters);
  }
}
