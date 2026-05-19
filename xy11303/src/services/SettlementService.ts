import { SettlementModel } from '../models/SettlementModel';
import { CleaningTaskModel } from '../models/CleaningTaskModel';
import { DeductionModel } from '../models/DeductionModel';
import { ReworkModel } from '../models/ReworkModel';
import { UserModel } from '../models/UserModel';
import { Settlement, SettlementStatus, DeductionType, TaskStatus } from '../types';
import { now } from '../models/database';

export interface CreateSettlementRequest {
  cleanerId: string;
  startDate: string;
  endDate: string;
  operatorId: string;
  remark?: string;
}

export interface SettlementResult {
  success: boolean;
  settlement?: Settlement;
  isDuplicate: boolean;
  error?: string;
}

export interface TaskSettlementDetail {
  taskId: string;
  taskNo: string;
  homestayName: string;
  baseAmount: number;
  reworkDeduction: number;
  overtimeDeduction: number;
  complaintDeduction: number;
  photoDeduction: number;
  otherDeduction: number;
  totalDeduction: number;
  netAmount: number;
  deductionIds: string[];
}

export class SettlementService {
  static async createSettlement(request: CreateSettlementRequest): Promise<SettlementResult> {
    const cleaner = UserModel.getById(request.cleanerId);
    if (!cleaner || !cleaner.isActive) {
      return { success: false, error: '保洁员不存在或无效', isDuplicate: false, settlement: undefined };
    }

    const existingSettlements = SettlementModel.list({
      cleanerId: request.cleanerId,
      status: SettlementStatus.PENDING
    });

    const overlappingSettlement = existingSettlements.find(s => 
      !(new Date(s.endDate) < new Date(request.startDate) || new Date(s.startDate) > new Date(request.endDate))
    );
    
    if (overlappingSettlement) {
      return { success: true, settlement: overlappingSettlement, isDuplicate: true };
    }

    const tasks = CleaningTaskModel.getTasksForSettlement(
      request.cleanerId,
      request.startDate,
      request.endDate
    );

    let totalBaseAmount = 0;
    let totalReworkCount = 0;
    let totalReworkDeduction = 0;
    let totalOvertimeDeduction = 0;
    let totalComplaintDeduction = 0;
    let totalPhotoDeduction = 0;
    let totalOtherDeduction = 0;

    const settlement = SettlementModel.create({
      cleanerId: request.cleanerId,
      cleanerName: cleaner.name,
      cleanerPhone: cleaner.phone,
      startDate: request.startDate,
      endDate: request.endDate,
      totalTasks: tasks.length,
      totalBaseAmount: 0,
      totalReworkCount: 0,
      totalReworkDeduction: 0,
      totalOvertimeDeduction: 0,
      totalComplaintDeduction: 0,
      totalPhotoDeduction: 0,
      totalOtherDeduction: 0,
      totalDeduction: 0,
      netAmount: 0,
      status: SettlementStatus.CALCULATING,
      operatorId: request.operatorId,
      operatorName: (UserModel.getById(request.operatorId)?.name || '',
      remark: request.remark
    });

    const taskDetails: TaskSettlementDetail[] = [];

    for (const task of tasks) {
      const detail = await this.calculateTaskSettlement(task.id, settlement.id);
      taskDetails.push(detail);
      
      totalBaseAmount += detail.baseAmount;
      totalReworkDeduction += detail.reworkDeduction;
      totalOvertimeDeduction += detail.overtimeDeduction;
      totalComplaintDeduction += detail.complaintDeduction;
      totalPhotoDeduction += detail.photoDeduction;
      totalOtherDeduction += detail.otherDeduction;

      const reworks = ReworkModel.getByTaskId(task.id);
      totalReworkCount += reworks.filter(r => r.status === TaskStatus.COMPLETED).length;
    }

    const totalDeduction = totalReworkDeduction + totalOvertimeDeduction + 
      totalComplaintDeduction + totalPhotoDeduction + totalOtherDeduction;
    const netAmount = totalBaseAmount - totalDeduction;

    SettlementModel.update(settlement.id, {
      totalBaseAmount,
      totalReworkCount,
      totalReworkDeduction,
      totalOvertimeDeduction,
      totalComplaintDeduction,
      totalPhotoDeduction,
      totalOtherDeduction,
      totalDeduction,
      netAmount,
      status: SettlementStatus.PENDING
    });

    return { 
      success: true, 
      settlement: SettlementModel.getById(settlement.id)!, 
      isDuplicate: false 
    };
  }

  private static async calculateTaskSettlement(taskId: string, settlementId: string): Promise<TaskSettlementDetail> {
    const task = CleaningTaskModel.getById(taskId)!;
    const deductions = DeductionModel.getByTaskId(taskId);

    const baseAmount = 100;

    let reworkDeduction = 0;
    let overtimeDeduction = 0;
    let complaintDeduction = 0;
    let photoDeduction = 0;
    let otherDeduction = 0;
    const deductionIds: string[] = [];

    for (const deduction of deductions) {
      if (deduction.isConfirmed && !deduction.settlementId) {
        switch (deduction.type) {
          case DeductionType.REWORK:
            reworkDeduction += deduction.amount;
            break;
          case DeductionType.OVERTIME:
            overtimeDeduction += deduction.amount;
            break;
          case DeductionType.COMPLAINT:
            complaintDeduction += deduction.amount;
            break;
          case DeductionType.MISSING_PHOTOS:
            photoDeduction += deduction.amount;
            break;
          default:
            otherDeduction += deduction.amount;
        }
        
        DeductionModel.update(deduction.id, { settlementId });
        deductionIds.push(deduction.id);
      }
    }

    const totalDeduction = reworkDeduction + overtimeDeduction + complaintDeduction + photoDeduction + otherDeduction;
    const netAmount = baseAmount - totalDeduction;

    SettlementModel.addItem({
      settlementId,
      taskId,
      orderId: task.orderId,
      taskNo: task.taskNo,
      homestayName: task.homestayName,
      baseAmount,
      reworkDeduction,
      overtimeDeduction,
      complaintDeduction,
      photoDeduction,
      otherDeduction,
      totalDeduction,
      netAmount,
      deductionIds: deductionIds.join(',')
    });

    return {
      taskId,
      taskNo: task.taskNo,
      homestayName: task.homestayName,
      baseAmount,
      reworkDeduction,
      overtimeDeduction,
      complaintDeduction,
      photoDeduction,
      otherDeduction,
      totalDeduction,
      netAmount,
      deductionIds
    };
  }

  static async confirmSettlement(settlementId: string, operatorId: string): Promise<{ success: boolean; settlement?: Settlement; error?: string }> {
    const settlement = SettlementModel.getById(settlementId);
    if (!settlement) {
      return { success: false, error: '结算单不存在' };
    }

    if (settlement.status !== SettlementStatus.PENDING) {
      return { success: false, error: '结算单状态不允许确认' };
    }

    const operator = UserModel.getById(operatorId);
    SettlementModel.update(settlementId, {
      status: SettlementStatus.CONFIRMED,
      confirmedAt: now(),
      operatorId,
      operatorName: operator?.name || ''
    });

    return { success: true, settlement: SettlementModel.getById(settlementId)! };
  }

  static async markAsPaid(settlementId: string, operatorId: string): Promise<{ success: boolean; settlement?: Settlement; error?: string }> {
    const settlement = SettlementModel.getById(settlementId);
    if (!settlement) {
      return { success: false, error: '结算单不存在' };
    }

    if (settlement.status !== SettlementStatus.CONFIRMED) {
      return { success: false, error: '结算单状态不允许标记为已支付' };
    }

    SettlementModel.update(settlementId, {
      status: SettlementStatus.PAID,
      paidAt: now()
    });

    return { success: true, settlement: SettlementModel.getById(settlementId)! };
  }

  static getSettlement(settlementId: string): Settlement | null {
    return SettlementModel.getById(settlementId);
  }

  static getSettlementItems(settlementId: string) {
    return {
      settlement: SettlementModel.getById(settlementId),
      items: SettlementModel.getItemsBySettlementId(settlementId),
      deductions: DeductionModel.getBySettlementId(settlementId)
    };
  }

  static listSettlements(filters: {
    cleanerId?: string;
    status?: SettlementStatus;
    startDate?: string;
    endDate?: string;
  } = {}): Settlement[] {
    return SettlementModel.list(filters);
  }
}
