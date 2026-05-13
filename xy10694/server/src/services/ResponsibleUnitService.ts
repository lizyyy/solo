import { v4 as uuidv4 } from 'uuid';
import ResponsibleUnit from '../models/ResponsibleUnit';
import ProblemType from '../models/ProblemType';

interface CheckBlockResult {
  blocked: boolean;
  reason?: string;
  responsibleUnit?: ResponsibleUnit;
}

class ResponsibleUnitService {
  async checkBlockRule(problemTypeId: string): Promise<CheckBlockResult> {
    const problemType = await ProblemType.findByPk(problemTypeId);
    if (!problemType) {
      return { blocked: true, reason: '问题类型不存在' };
    }

    if (!problemType.defaultUnitId) {
      return { blocked: true, reason: '该问题类型未配置责任单位，需要人工介入' };
    }

    const responsibleUnit = await ResponsibleUnit.findByPk(problemType.defaultUnitId);
    if (!responsibleUnit) {
      return { blocked: true, reason: '配置的责任单位不存在' };
    }

    if (!responsibleUnit.isActive) {
      return { blocked: true, reason: '责任单位已停用' };
    }

    const canHandleTypes = responsibleUnit.canHandleTypes ? JSON.parse(responsibleUnit.canHandleTypes) : [];
    if (canHandleTypes.length > 0 && !canHandleTypes.includes(problemTypeId)) {
      return { blocked: true, reason: '该责任单位不具备处理此类型问题的权限' };
    }

    return { blocked: false, responsibleUnit };
  }

  async getResponsibleUnitById(id: string): Promise<ResponsibleUnit | null> {
    return await ResponsibleUnit.findByPk(id);
  }

  async getActiveUnits(): Promise<ResponsibleUnit[]> {
    return await ResponsibleUnit.findAll({
      where: { isActive: true },
      order: [['level', 'ASC']]
    });
  }

  async createUnit(data: any): Promise<ResponsibleUnit> {
    return await ResponsibleUnit.create({
      id: uuidv4(),
      ...data,
      isActive: true
    });
  }
}

export default new ResponsibleUnitService();
