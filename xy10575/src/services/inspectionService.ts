import { inspectionRepository } from '../repositories/inspectionRepository';
import { templateRepository } from '../repositories/templateRepository';
import { equipmentRepository } from '../repositories/equipmentRepository';
import { historyRepository } from '../repositories/historyRepository';
import { exceptionRepository } from '../repositories/exceptionRepository';
import { db } from '../database';
import { ShiftInspection, InspectionItemResult, InspectionStatus, ItemType, ExceptionStatus, EquipmentStatus } from '../models';
import { BusinessError } from './equipmentService';

export class InspectionService {
  async create(
    data: {
      equipmentId: string;
      templateId: string;
      shift: string;
      shiftDate: string;
      idempotentKey?: string;
    },
    operator: { id: string; name: string }
  ): Promise<ShiftInspection> {
    if (data.idempotentKey) {
      const existing = await inspectionRepository.findByIdempotentKey(data.idempotentKey);
      if (existing) {
        return existing;
      }
    }

    const equipment = await equipmentRepository.findById(data.equipmentId);
    if (!equipment) {
      throw new BusinessError('EQUIPMENT_NOT_FOUND', '设备不存在');
    }

    const template = await templateRepository.findTemplateById(data.templateId);
    if (!template) {
      throw new BusinessError('TEMPLATE_NOT_FOUND', '模板不存在');
    }

    const duplicate = await inspectionRepository.findByEquipmentShiftDate(
      data.equipmentId, data.shiftDate, data.shift
    );
    if (duplicate) {
      throw new BusinessError('DUPLICATE_SHIFT_INSPECTION', `该设备 ${data.shiftDate} ${data.shift} 班已有点检记录`);
    }

    const inspection = await inspectionRepository.create({
      ...data,
      inspectorId: operator.id,
      inspectorName: operator.name,
      status: InspectionStatus.IN_PROGRESS,
      startTime: db.now()
    });

    await historyRepository.create({
      entityType: 'INSPECTION',
      entityId: inspection.id,
      action: 'CREATE',
      toStatus: InspectionStatus.IN_PROGRESS,
      changes: JSON.stringify(data),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    return inspection;
  }

  async getById(id: string): Promise<ShiftInspection | undefined> {
    return inspectionRepository.findById(id);
  }

  async getAll(filters?: { equipmentId?: string; shiftDate?: string; status?: string }): Promise<ShiftInspection[]> {
    return inspectionRepository.findAll(filters);
  }

  async checkItem(
    inspectionId: string,
    itemResult: {
      itemId: string;
      actualValue?: string;
      isNormal: boolean;
      remark?: string;
    },
    operator: { id: string; name: string }
  ): Promise<InspectionItemResult> {
    const inspection = await inspectionRepository.findById(inspectionId);
    if (!inspection) {
      throw new BusinessError('INSPECTION_NOT_FOUND', '点检记录不存在');
    }
    if (inspection.status === InspectionStatus.COMPLETED || inspection.status === InspectionStatus.CLOSED) {
      throw new BusinessError('INSPECTION_ALREADY_COMPLETED', '点检已完成，不能再点检项目');
    }

    const items = await templateRepository.findItemsByTemplate(inspection.templateId);
    const item = items.find(i => i.id === itemResult.itemId);
    if (!item) {
      throw new BusinessError('ITEM_NOT_FOUND', '点检项目不存在');
    }

    const result = await inspectionRepository.createItemResult({
      inspectionId,
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      standard: item.standard,
      actualValue: itemResult.actualValue,
      isNormal: itemResult.isNormal,
      remark: itemResult.remark,
      checkedAt: db.now(),
      checkedBy: operator.id
    });

    if (!itemResult.isNormal) {
      if (item.itemType === ItemType.KEY) {
        const existingExceptions = await exceptionRepository.findAllExceptions({
          inspectionId,
          equipmentId: inspection.equipmentId
        });
        const hasOpen = existingExceptions.some(e => 
          e.status !== ExceptionStatus.RESOLVED
        );
        
        if (!hasOpen) {
          await equipmentRepository.updateStatus(inspection.equipmentId, EquipmentStatus.ABNORMAL);
          await historyRepository.create({
            entityType: 'EQUIPMENT',
            entityId: inspection.equipmentId,
            action: 'STATUS_CHANGE',
            fromStatus: (await equipmentRepository.findById(inspection.equipmentId))?.status,
            toStatus: EquipmentStatus.ABNORMAL,
            changes: JSON.stringify({ reason: '关键项异常' }),
            operatorId: operator.id,
            operatorName: operator.name,
            reason: '关键项异常触发',
            timestamp: db.now()
          });
        }
      }

      const inspectionForUpdate = await inspectionRepository.findById(inspectionId);
      if (inspectionForUpdate?.status !== InspectionStatus.EXCEPTION) {
        const fromStatus = inspectionForUpdate?.status;
        await inspectionRepository.update(inspectionId, {
          status: InspectionStatus.EXCEPTION
        });
        await historyRepository.create({
          entityType: 'INSPECTION',
          entityId: inspectionId,
          action: 'STATUS_CHANGE',
          fromStatus,
          toStatus: InspectionStatus.EXCEPTION,
          changes: JSON.stringify({ item: item.name }),
          operatorId: operator.id,
          operatorName: operator.name,
          reason: '项目点检异常',
          timestamp: db.now()
        });
      }
    }

    return result;
  }

  async getItemResults(inspectionId: string): Promise<InspectionItemResult[]> {
    return inspectionRepository.findItemResultsByInspection(inspectionId);
  }

  async complete(
    inspectionId: string,
    operator: { id: string; name: string }
  ): Promise<ShiftInspection> {
    const inspection = await inspectionRepository.findById(inspectionId);
    if (!inspection) {
      throw new BusinessError('INSPECTION_NOT_FOUND', '点检记录不存在');
    }
    if (inspection.status === InspectionStatus.COMPLETED || inspection.status === InspectionStatus.CLOSED) {
      return inspection;
    }

    const openExceptions = await exceptionRepository.findAllExceptions({
      inspectionId,
      equipmentId: inspection.equipmentId
    });
    const hasUnresolved = openExceptions.some(e => 
      e.status !== ExceptionStatus.RESOLVED
    );
    if (hasUnresolved) {
      throw new BusinessError('UNRESOLVED_EXCEPTIONS', '存在未解决的异常，无法完成点检');
    }

    const fromStatus = inspection.status;
    await inspectionRepository.update(inspectionId, {
      status: InspectionStatus.COMPLETED,
      endTime: db.now()
    });

    await historyRepository.create({
      entityType: 'INSPECTION',
      entityId: inspectionId,
      action: 'COMPLETE',
      fromStatus,
      toStatus: InspectionStatus.COMPLETED,
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    const updated = await inspectionRepository.findById(inspectionId);
    return updated!;
  }

  async close(
    inspectionId: string,
    operator: { id: string; name: string }
  ): Promise<ShiftInspection> {
    const inspection = await inspectionRepository.findById(inspectionId);
    if (!inspection) {
      throw new BusinessError('INSPECTION_NOT_FOUND', '点检记录不存在');
    }

    const openExceptions = await exceptionRepository.findAllExceptions({
      inspectionId,
      equipmentId: inspection.equipmentId
    });
    const hasUnresolved = openExceptions.some(e => 
      e.status !== ExceptionStatus.RESOLVED
    );
    if (hasUnresolved) {
      throw new BusinessError('UNRESOLVED_EXCEPTIONS', '存在未解决的异常，无法关闭点检');
    }

    if (inspection.status !== InspectionStatus.COMPLETED) {
      throw new BusinessError('INCOMPLETE_INSPECTION', '点检未完成，无法关闭');
    }

    const fromStatus = inspection.status;
    await inspectionRepository.update(inspectionId, {
      status: InspectionStatus.CLOSED
    });

    await historyRepository.create({
      entityType: 'INSPECTION',
      entityId: inspectionId,
      action: 'CLOSE',
      fromStatus,
      toStatus: InspectionStatus.CLOSED,
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });

    const updated = await inspectionRepository.findById(inspectionId);
    return updated!;
  }
}

export const inspectionService = new InspectionService();
