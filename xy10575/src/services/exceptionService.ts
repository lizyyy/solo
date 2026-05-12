import { exceptionRepository } from '../repositories/exceptionRepository';
import { inspectionRepository } from '../repositories/inspectionRepository';
import { equipmentRepository } from '../repositories/equipmentRepository';
import { historyRepository } from '../repositories/historyRepository';
import { db } from '../database';
import { 
  ExceptionRecord, ExceptionStatus, DowntimeRecord, DowntimeStatus, 
  MaintenanceAssignment, MaintenanceStatus, RecheckRecord, RecheckStatus,
  ItemType, EquipmentStatus, InspectionStatus
} from '../models';
import { BusinessError } from './equipmentService';
import moment from 'moment';

export class ExceptionService {
  async reportException(
    data: {
      inspectionId: string;
      itemResultId?: string;
      description: string;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      idempotentKey?: string;
    },
    operator: { id: string; name: string }
  ): Promise<ExceptionRecord> {
    if (data.idempotentKey) {
      const existing = await exceptionRepository.findExceptionByIdempotentKey(data.idempotentKey);
      if (existing) {
        return existing;
      }
    }

    const inspection = await inspectionRepository.findById(data.inspectionId);
    if (!inspection) {
      throw new BusinessError('INSPECTION_NOT_FOUND', '点检记录不存在');
    }

    let itemResult: any = null;
    let item: any = null;
    if (data.itemResultId) {
      const results = await inspectionRepository.findItemResultsByInspection(data.inspectionId);
      itemResult = results.find(r => r.id === data.itemResultId);
      const items = await this.getTemplateItems(inspection.templateId);
      if (itemResult) {
        item = items.find(i => i.id === itemResult.itemId);
      }
    }

    const exception = await exceptionRepository.createException({
      inspectionId: data.inspectionId,
      itemResultId: data.itemResultId,
      equipmentId: inspection.equipmentId,
      itemId: item?.id,
      itemName: item?.name,
      itemType: item?.itemType,
      description: data.description,
      level: data.level,
      reporterId: operator.id,
      reporterName: operator.name,
      status: ExceptionStatus.DETECTED,
      detectedAt: db.now(),
      idempotentKey: data.idempotentKey
    });

    if (item?.itemType === ItemType.KEY) {
      await equipmentRepository.updateStatus(inspection.equipmentId, EquipmentStatus.ABNORMAL);
      await historyRepository.create({
        entityType: 'EQUIPMENT',
        entityId: inspection.equipmentId,
        action: 'STATUS_CHANGE',
        toStatus: EquipmentStatus.ABNORMAL,
        changes: JSON.stringify({ reason: '关键项异常' }),
        operatorId: operator.id,
        operatorName: operator.name,
        reason: '关键项异常触发',
        timestamp: db.now()
      });
    }

    const inspectionForUpdate = await inspectionRepository.findById(data.inspectionId);
    if (inspectionForUpdate?.status !== InspectionStatus.EXCEPTION) {
      const fromStatus = inspectionForUpdate?.status;
      await inspectionRepository.update(data.inspectionId, {
        status: InspectionStatus.EXCEPTION
      });
      await historyRepository.create({
        entityType: 'INSPECTION',
        entityId: data.inspectionId,
        action: 'STATUS_CHANGE',
        fromStatus,
        toStatus: InspectionStatus.EXCEPTION,
        operatorId: operator.id,
        operatorName: operator.name,
        reason: '发现异常',
        timestamp: db.now()
      });
    }

    await historyRepository.create({
      entityType: 'EXCEPTION',
      entityId: exception.id,
      action: 'DETECTED',
      toStatus: ExceptionStatus.DETECTED,
      changes: JSON.stringify({ description: data.description, level: data.level }),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    return exception;
  }

  async getExceptionById(id: string): Promise<ExceptionRecord | undefined> {
    return exceptionRepository.findExceptionById(id);
  }

  async getAllExceptions(filters?: { equipmentId?: string; status?: string; inspectionId?: string }): Promise<ExceptionRecord[]> {
    return exceptionRepository.findAllExceptions(filters);
  }

  async createDowntime(
    data: {
      equipmentId: string;
      exceptionId?: string;
      inspectionId?: string;
      reason: string;
      startTime?: string;
      idempotentKey?: string;
    },
    operator: { id: string; name: string }
  ): Promise<DowntimeRecord> {
    if (data.idempotentKey) {
      const existing = await exceptionRepository.findDowntimeByIdempotentKey(data.idempotentKey);
      if (existing) {
        return existing;
      }
    }

    const equipment = await equipmentRepository.findById(data.equipmentId);
    if (!equipment) {
      throw new BusinessError('EQUIPMENT_NOT_FOUND', '设备不存在');
    }

    if (data.exceptionId) {
      const exception = await exceptionRepository.findExceptionById(data.exceptionId);
      if (!exception) {
        throw new BusinessError('EXCEPTION_NOT_FOUND', '异常记录不存在');
      }
    }

    const downtime = await exceptionRepository.createDowntime({
      equipmentId: data.equipmentId,
      exceptionId: data.exceptionId,
      inspectionId: data.inspectionId,
      reason: data.reason,
      startTime: data.startTime || db.now(),
      operatorId: operator.id,
      operatorName: operator.name,
      status: DowntimeStatus.IN_PROGRESS,
      idempotentKey: data.idempotentKey
    });

    await equipmentRepository.updateStatus(data.equipmentId, EquipmentStatus.STOPPED);
    await historyRepository.create({
      entityType: 'EQUIPMENT',
      entityId: data.equipmentId,
      action: 'STATUS_CHANGE',
      fromStatus: equipment.status,
      toStatus: EquipmentStatus.STOPPED,
      changes: JSON.stringify({ reason: data.reason }),
      operatorId: operator.id,
      operatorName: operator.name,
      reason: '安排停机',
      timestamp: db.now()
    });

    if (data.exceptionId) {
      const exception = await exceptionRepository.findExceptionById(data.exceptionId);
      if (exception && exception.status === ExceptionStatus.DETECTED) {
        await exceptionRepository.updateException(data.exceptionId, {
          status: ExceptionStatus.DOWNTIME_SCHEDULED
        });
        await historyRepository.create({
          entityType: 'EXCEPTION',
          entityId: data.exceptionId,
          action: 'DOWNTIME_SCHEDULED',
          fromStatus: ExceptionStatus.DETECTED,
          toStatus: ExceptionStatus.DOWNTIME_SCHEDULED,
          operatorId: operator.id,
          operatorName: operator.name,
          timestamp: db.now()
        });
      }
    }

    await historyRepository.create({
      entityType: 'DOWNTIME',
      entityId: downtime.id,
      action: 'START',
      toStatus: DowntimeStatus.IN_PROGRESS,
      changes: JSON.stringify({ reason: data.reason }),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    return downtime;
  }

  async endDowntime(
    downtimeId: string,
    operator: { id: string; name: string }
  ): Promise<DowntimeRecord> {
    const downtime = await exceptionRepository.findDowntimeById(downtimeId);
    if (!downtime) {
      throw new BusinessError('DOWNTIME_NOT_FOUND', '停机记录不存在');
    }
    if (downtime.status === DowntimeStatus.COMPLETED) {
      return downtime;
    }

    const endTime = db.now();
    const start = moment(downtime.startTime);
    const end = moment(endTime);
    const durationMinutes = Math.ceil(end.diff(start, 'minutes'));

    await exceptionRepository.updateDowntime(downtimeId, {
      status: DowntimeStatus.COMPLETED,
      endTime,
      durationMinutes
    });

    await historyRepository.create({
      entityType: 'DOWNTIME',
      entityId: downtimeId,
      action: 'END',
      fromStatus: downtime.status,
      toStatus: DowntimeStatus.COMPLETED,
      changes: JSON.stringify({ durationMinutes }),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    const updated = await exceptionRepository.findDowntimeById(downtimeId);
    return updated!;
  }

  async getAllDowntime(filters?: { equipmentId?: string; status?: string; exceptionId?: string }): Promise<DowntimeRecord[]> {
    return exceptionRepository.findAllDowntime(filters);
  }

  async assignMaintenance(
    data: {
      exceptionId: string;
      assigneeId: string;
      assigneeName: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      description: string;
      idempotentKey?: string;
    },
    operator: { id: string; name: string }
  ): Promise<MaintenanceAssignment> {
    if (data.idempotentKey) {
      const existing = await exceptionRepository.findMaintenanceByIdempotentKey(data.idempotentKey);
      if (existing) {
        return existing;
      }
    }

    const exception = await exceptionRepository.findExceptionById(data.exceptionId);
    if (!exception) {
      throw new BusinessError('EXCEPTION_NOT_FOUND', '异常记录不存在');
    }

    const maintenance = await exceptionRepository.createMaintenance({
      exceptionId: data.exceptionId,
      equipmentId: exception.equipmentId,
      assigneeId: data.assigneeId,
      assigneeName: data.assigneeName,
      priority: data.priority,
      description: data.description,
      status: MaintenanceStatus.ASSIGNED,
      assignedAt: db.now(),
      idempotentKey: data.idempotentKey
    });

    await exceptionRepository.updateException(data.exceptionId, {
      status: ExceptionStatus.MAINTENANCE_ASSIGNED
    });

    await equipmentRepository.updateStatus(exception.equipmentId, EquipmentStatus.MAINTENANCE);
    await historyRepository.create({
      entityType: 'EQUIPMENT',
      entityId: exception.equipmentId,
      action: 'STATUS_CHANGE',
      toStatus: EquipmentStatus.MAINTENANCE,
      changes: JSON.stringify({ reason: '安排维修' }),
      operatorId: operator.id,
      operatorName: operator.name,
      reason: '维修派工',
      timestamp: db.now()
    });

    await historyRepository.create({
      entityType: 'EXCEPTION',
      entityId: data.exceptionId,
      action: 'MAINTENANCE_ASSIGNED',
      fromStatus: exception.status,
      toStatus: ExceptionStatus.MAINTENANCE_ASSIGNED,
      changes: JSON.stringify({ assignee: data.assigneeName }),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    await historyRepository.create({
      entityType: 'MAINTENANCE',
      entityId: maintenance.id,
      action: 'ASSIGN',
      toStatus: MaintenanceStatus.ASSIGNED,
      changes: JSON.stringify(data),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    return maintenance;
  }

  async startMaintenance(
    maintenanceId: string,
    operator: { id: string; name: string }
  ): Promise<MaintenanceAssignment> {
    const maintenance = await exceptionRepository.findMaintenanceById(maintenanceId);
    if (!maintenance) {
      throw new BusinessError('MAINTENANCE_NOT_FOUND', '维修任务不存在');
    }
    if (maintenance.status !== MaintenanceStatus.ASSIGNED) {
      if (maintenance.status === MaintenanceStatus.IN_PROGRESS || maintenance.status === MaintenanceStatus.COMPLETED) {
        return maintenance;
      }
      throw new BusinessError('INVALID_STATUS', '维修任务状态不允许开始');
    }

    await exceptionRepository.updateMaintenance(maintenanceId, {
      status: MaintenanceStatus.IN_PROGRESS,
      startedAt: db.now()
    });

    await historyRepository.create({
      entityType: 'MAINTENANCE',
      entityId: maintenanceId,
      action: 'START',
      fromStatus: maintenance.status,
      toStatus: MaintenanceStatus.IN_PROGRESS,
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    const updated = await exceptionRepository.findMaintenanceById(maintenanceId);
    return updated!;
  }

  async completeMaintenance(
    maintenanceId: string,
    result: string,
    operator: { id: string; name: string }
  ): Promise<MaintenanceAssignment> {
    const maintenance = await exceptionRepository.findMaintenanceById(maintenanceId);
    if (!maintenance) {
      throw new BusinessError('MAINTENANCE_NOT_FOUND', '维修任务不存在');
    }
    if (maintenance.status === MaintenanceStatus.COMPLETED) {
      return maintenance;
    }
    if (maintenance.status !== MaintenanceStatus.IN_PROGRESS) {
      throw new BusinessError('INVALID_STATUS', '维修任务未开始，无法完成');
    }

    await exceptionRepository.updateMaintenance(maintenanceId, {
      status: MaintenanceStatus.COMPLETED,
      completedAt: db.now(),
      result
    });

    await exceptionRepository.updateException(maintenance.exceptionId, {
      status: ExceptionStatus.MAINTENANCE_COMPLETED
    });

    await historyRepository.create({
      entityType: 'EXCEPTION',
      entityId: maintenance.exceptionId,
      action: 'MAINTENANCE_COMPLETED',
      toStatus: ExceptionStatus.MAINTENANCE_COMPLETED,
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    await historyRepository.create({
      entityType: 'MAINTENANCE',
      entityId: maintenanceId,
      action: 'COMPLETE',
      fromStatus: maintenance.status,
      toStatus: MaintenanceStatus.COMPLETED,
      changes: JSON.stringify({ result }),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    const updated = await exceptionRepository.findMaintenanceById(maintenanceId);
    return updated!;
  }

  async getMaintenanceById(id: string): Promise<MaintenanceAssignment | undefined> {
    return exceptionRepository.findMaintenanceById(id);
  }

  async getMaintenanceByException(exceptionId: string): Promise<MaintenanceAssignment[]> {
    return exceptionRepository.findMaintenanceByException(exceptionId);
  }

  async recheck(
    data: {
      exceptionId: string;
      result: RecheckStatus;
      remark?: string;
      idempotentKey?: string;
    },
    operator: { id: string; name: string }
  ): Promise<RecheckRecord> {
    if (data.idempotentKey) {
      const existing = await exceptionRepository.findRecheckByIdempotentKey(data.idempotentKey);
      if (existing) {
        return existing;
      }
    }

    const exception = await exceptionRepository.findExceptionById(data.exceptionId);
    if (!exception) {
      throw new BusinessError('EXCEPTION_NOT_FOUND', '异常记录不存在');
    }

    if (exception.status !== ExceptionStatus.MAINTENANCE_COMPLETED) {
      throw new BusinessError('INVALID_EXCEPTION_STATUS', '异常状态不允许复检');
    }

    const maintenances = await exceptionRepository.findMaintenanceByException(data.exceptionId);
    const lastMaintenance = maintenances[0];

    const recheck = await exceptionRepository.createRecheck({
      exceptionId: data.exceptionId,
      equipmentId: exception.equipmentId,
      maintenanceId: lastMaintenance?.id,
      inspectionId: exception.inspectionId,
      recheckerId: operator.id,
      recheckerName: operator.name,
      result: data.result,
      remark: data.remark,
      recheckedAt: db.now(),
      idempotentKey: data.idempotentKey
    });

    if (data.result === RecheckStatus.PASSED) {
      await exceptionRepository.updateException(data.exceptionId, {
        status: ExceptionStatus.RESOLVED,
        resolvedAt: db.now()
      });

      await equipmentRepository.updateStatus(exception.equipmentId, EquipmentStatus.RUNNING);
      await historyRepository.create({
        entityType: 'EQUIPMENT',
        entityId: exception.equipmentId,
        action: 'STATUS_CHANGE',
        toStatus: EquipmentStatus.RUNNING,
        changes: JSON.stringify({ reason: '异常已解决' }),
        operatorId: operator.id,
        operatorName: operator.name,
        reason: '复检通过',
        timestamp: db.now()
      });

      await historyRepository.create({
        entityType: 'EXCEPTION',
        entityId: data.exceptionId,
        action: 'RESOLVED',
        fromStatus: exception.status,
        toStatus: ExceptionStatus.RESOLVED,
        operatorId: operator.id,
        operatorName: operator.name,
        timestamp: db.now()
      });
    } else {
      await exceptionRepository.updateException(data.exceptionId, {
        status: ExceptionStatus.RECHECK_FAILED
      });

      await historyRepository.create({
        entityType: 'EXCEPTION',
        entityId: data.exceptionId,
        action: 'RECHECK_FAILED',
        fromStatus: exception.status,
        toStatus: ExceptionStatus.RECHECK_FAILED,
        operatorId: operator.id,
        operatorName: operator.name,
        reason: data.remark,
        timestamp: db.now()
      });
    }

    await historyRepository.create({
      entityType: 'RECHECK',
      entityId: recheck.id,
      action: 'RECHECK',
      toStatus: data.result,
      changes: JSON.stringify({ result: data.result, remark: data.remark }),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    return recheck;
  }

  async getRechecksByException(exceptionId: string): Promise<RecheckRecord[]> {
    return exceptionRepository.findRechecksByException(exceptionId);
  }

  async manualCorrection(
    entityType: string,
    entityId: string,
    correction: {
      field: string;
      oldValue: any;
      newValue: any;
      reason: string;
    },
    operator: { id: string; name: string }
  ): Promise<void> {
    await historyRepository.create({
      entityType,
      entityId,
      action: 'MANUAL_CORRECTION',
      changes: JSON.stringify({
        field: correction.field,
        oldValue: correction.oldValue,
        newValue: correction.newValue
      }),
      operatorId: operator.id,
      operatorName: operator.name,
      reason: correction.reason,
      timestamp: db.now()
    });
  }

  private async getTemplateItems(templateId: string): Promise<any[]> {
    try {
      const repo = require('../repositories/templateRepository').templateRepository;
      return await repo.findItemsByTemplate(templateId);
    } catch {
      return [];
    }
  }
}

export const exceptionService = new ExceptionService();
