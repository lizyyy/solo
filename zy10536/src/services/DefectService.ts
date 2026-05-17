import { DefectDAO } from '../dao/DefectDAO';
import { Defect, DefectStatus, DefectType, CreateDefectRequest, UpdateDefectStatusRequest, ManualCorrectionRequest } from '../models/types';

const defectDAO = new DefectDAO();

export class DefectService {
  async createDefect(request: CreateDefectRequest): Promise<Defect> {
    this.validateDefectRequest(request);

    const defect = await defectDAO.create({
      procurementOrderNo: request.procurementOrderNo,
      equipmentNo: request.equipmentNo,
      defectType: request.defectType,
      description: request.description,
      status: DefectStatus.REGISTERED,
      inspector: request.inspector
    });

    if (request.photos && request.photos.length > 0) {
      for (const photo of request.photos) {
        await defectDAO.addPhoto(defect.id, photo);
      }
    }

    return defectDAO.getById(defect.id) as Promise<Defect>;
  }

  async getDefectById(id: string): Promise<Defect | null> {
    return defectDAO.getById(id);
  }

  async getDefects(filters?: { procurementOrderNo?: string; equipmentNo?: string; status?: DefectStatus }): Promise<Defect[]> {
    return defectDAO.getAll(filters);
  }

  async updateDefectStatus(id: string, request: UpdateDefectStatusRequest): Promise<Defect> {
    const defect = await defectDAO.getById(id);
    if (!defect) {
      throw new Error(`缺陷不存在: ${id}`);
    }

    this.validateStatusTransition(defect.status, request.status);

    if (request.rectification) {
      if (request.status !== DefectStatus.IN_RECTIFICATION && request.status !== DefectStatus.REGISTERED) {
        throw new Error('只有在"已登记"或"整改中"状态才能设置整改要求');
      }
      await defectDAO.setRectification(id, request.rectification);
    }

    if (request.reinspection) {
      if (request.status !== DefectStatus.PENDING_REINSPECTION && request.status !== DefectStatus.PASSED) {
        throw new Error('只有在"待复验"或"已通过"状态才能添加复验记录');
      }
      await defectDAO.addReinspection(id, request.reinspection);
    }

    await defectDAO.updateStatus(id, request.status);

    return defectDAO.getById(id) as Promise<Defect>;
  }

  async manualCorrect(id: string, request: ManualCorrectionRequest): Promise<Defect> {
    const defect = await defectDAO.getById(id);
    if (!defect) {
      throw new Error(`缺陷不存在: ${id}`);
    }

    const allowedFields = ['description', 'defectType', 'inspector', 'procurementOrderNo', 'equipmentNo'];
    if (!allowedFields.includes(request.field)) {
      throw new Error(`不允许修改字段: ${request.field}`);
    }

    await defectDAO.addManualCorrection(id, {
      field: request.field,
      oldValue: request.oldValue,
      newValue: request.newValue,
      reason: request.reason,
      operator: request.operator
    });

    return defect;
  }

  async getOverdueDefects(): Promise<Defect[]> {
    const allDefects = await defectDAO.getAll();
    return allDefects.filter(d => d.isOverdue && d.status !== DefectStatus.PASSED && d.status !== DefectStatus.CLOSED);
  }

  private validateDefectRequest(request: CreateDefectRequest): void {
    if (!request.procurementOrderNo?.trim()) {
      throw new Error('采购单号不能为空');
    }
    if (!request.equipmentNo?.trim()) {
      throw new Error('设备编号不能为空');
    }
    if (!Object.values(DefectType).includes(request.defectType)) {
      throw new Error(`无效的缺陷类型: ${request.defectType}`);
    }
    if (!request.description?.trim()) {
      throw new Error('缺陷描述不能为空');
    }
    if (!request.inspector?.trim()) {
      throw new Error('检验员不能为空');
    }
  }

  private validateStatusTransition(currentStatus: DefectStatus, newStatus: DefectStatus): void {
    const validTransitions: Record<DefectStatus, DefectStatus[]> = {
      [DefectStatus.REGISTERED]: [DefectStatus.IN_RECTIFICATION, DefectStatus.CLOSED],
      [DefectStatus.IN_RECTIFICATION]: [DefectStatus.PENDING_REINSPECTION, DefectStatus.CLOSED],
      [DefectStatus.PENDING_REINSPECTION]: [DefectStatus.IN_RECTIFICATION, DefectStatus.PASSED, DefectStatus.CLOSED],
      [DefectStatus.PASSED]: [DefectStatus.CLOSED],
      [DefectStatus.CLOSED]: []
    };

    const allowedStatuses = validTransitions[currentStatus];
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(`无效的状态转换: ${currentStatus} -> ${newStatus}`);
    }
  }
}
