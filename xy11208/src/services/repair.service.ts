import { RepairModel } from '../models/repair.model';
import { InspectionModel } from '../models/inspection.model';
import { AuditModel } from '../models/audit.model';
import { ValidationService } from './validation.service';
import { RepairRecord, BatchResult } from '../types';

export class RepairService {
  static createRepair(
    data: Omit<RepairRecord, 'id' | 'created_at' | 'updated_at' | 'escalated' | 'escalated_at' | 'resolved_at' | 'resolution' | 'retest_failed' | 'retest_remark'>,
    operatorId?: number
  ): { success: boolean; id?: number; reason?: string } {
    const validation = ValidationService.validateRepairCreation(
      data.pump_room_id,
      data.problem_description
    );

    if (!validation.valid && validation.shouldBlock) {
      return { success: false, reason: validation.reason };
    }

    const id = RepairModel.create({
      ...data,
      escalated: false,
      retest_failed: false
    } as any);

    AuditModel.log({
      operation_type: '创建报修',
      record_type: 'repair',
      record_id: id,
      action: 'create',
      reason: validation.valid ? '校验通过' : validation.reason,
      passed: true,
      operator_id: operatorId,
      details: JSON.stringify(data)
    });

    InspectionModel.updateStatus(data.inspection_id, '已报修');

    return { success: true, id };
  }

  static batchCreateRepairs(
    repairs: Array<Omit<RepairRecord, 'id' | 'created_at' | 'updated_at' | 'escalated' | 'escalated_at' | 'resolved_at' | 'resolution' | 'retest_failed' | 'retest_remark'>>,
    operatorId?: number
  ): BatchResult<RepairRecord> {
    const successful: Array<{ index: number; id: number; data: RepairRecord }> = [];
    const failed: Array<{ index: number; data: RepairRecord; error: string }> = [];

    repairs.forEach((repair, index) => {
      try {
        const result = this.createRepair(repair, operatorId);
        if (result.success && result.id) {
          successful.push({
            index,
            id: result.id,
            data: { ...repair, id: result.id } as RepairRecord
          });
        } else {
          failed.push({
            index,
            data: repair as RepairRecord,
            error: result.reason || '创建失败'
          });
        }
      } catch (error: any) {
        failed.push({
          index,
          data: repair as RepairRecord,
          error: error.message
        });
      }
    });

    return {
      success: failed.length === 0,
      total: repairs.length,
      successCount: successful.length,
      failedCount: failed.length,
      successful,
      failed
    };
  }

  static updateStatus(
    repairId: number,
    targetStatus: string,
    operatorId?: number,
    remark?: string
  ): { success: boolean; reason?: string } {
    const repair = RepairModel.getById(repairId);
    if (!repair) {
      return { success: false, reason: '报修记录不存在' };
    }

    const validation = ValidationService.validateStatusTransition(
      repair.status,
      targetStatus
    );

    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    RepairModel.update(repairId, { status: targetStatus } as any);

    AuditModel.log({
      operation_type: '状态变更',
      record_type: 'repair',
      record_id: repairId,
      action: `status_change_${repair.status}_to_${targetStatus}`,
      reason: remark || validation.reason,
      passed: true,
      operator_id: operatorId
    });

    return { success: true };
  }

  static handleRetest(
    repairId: number,
    passed: boolean,
    remark: string,
    operatorId?: number
  ): { success: boolean; reason?: string } {
    const validation = ValidationService.validateRetest(repairId, passed);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    if (passed) {
      RepairModel.update(repairId, {
        status: '已完成',
        retest_failed: false,
        retest_remark: remark,
        resolved_at: new Date().toISOString()
      });

      AuditModel.log({
        operation_type: '复测通过',
        record_type: 'repair',
        record_id: repairId,
        action: 'retest_pass',
        reason: remark,
        passed: true,
        operator_id: operatorId
      });
    } else {
      RepairModel.update(repairId, {
        status: '处理中',
        retest_failed: true,
        retest_remark: remark
      });

      AuditModel.log({
        operation_type: '复测不合格',
        record_type: 'repair',
        record_id: repairId,
        action: 'retest_fail',
        reason: remark,
        passed: false,
        operator_id: operatorId
      });
    }

    return { success: true };
  }

  static checkAndEscalateOverdue(operatorId?: number): { escalated: number } {
    const overdueRepairs = RepairModel.getOverdue();
    let escalatedCount = 0;

    for (const repair of overdueRepairs) {
      RepairModel.update(repair.id, {
        escalated: true,
        escalated_at: new Date().toISOString(),
        priority: '紧急'
      });

      AuditModel.log({
        operation_type: '超时升级',
        record_type: 'repair',
        record_id: repair.id,
        action: 'escalate_overdue',
        reason: '报修超时未处理，已自动升级为紧急',
        passed: true,
        operator_id: operatorId
      });

      escalatedCount++;
    }

    return { escalated: escalatedCount };
  }

  static assignHandler(
    repairId: number,
    handlerId: number,
    operatorId?: number
  ): { success: boolean; reason?: string } {
    const repair = RepairModel.getById(repairId);
    if (!repair) {
      return { success: false, reason: '报修记录不存在' };
    }

    if (repair.status !== '待派单') {
      return { success: false, reason: '只能派单给待派单状态的报修' };
    }

    RepairModel.update(repairId, {
      handler_id: handlerId,
      status: '处理中'
    });

    AuditModel.log({
      operation_type: '派单',
      record_type: 'repair',
      record_id: repairId,
      action: 'assign_handler',
      reason: `派单给负责人ID: ${handlerId}`,
      passed: true,
      operator_id: operatorId
    });

    return { success: true };
  }
}
