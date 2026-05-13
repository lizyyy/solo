import { v4 as uuidv4 } from 'uuid';
import ProblemType from '../models/ProblemType';
import ModificationHistory, { EntityType } from '../models/ModificationHistory';

interface CreateProblemTypeParams {
  name: string;
  code: string;
  parentId?: string;
  level?: number;
  defaultUnitId?: string;
  priority?: number;
  operatorId: string;
  operatorName: string;
}

interface UpdateProblemTypeParams extends Partial<CreateProblemTypeParams> {
  id: string;
  reason?: string;
}

class ProblemTypeService {
  async createProblemType(params: CreateProblemTypeParams): Promise<ProblemType> {
    const { operatorId, operatorName, ...data } = params;

    const problemType = await ProblemType.create({
      id: uuidv4(),
      ...data,
      isActive: true
    });

    return problemType;
  }

  async updateProblemType(params: UpdateProblemTypeParams): Promise<ProblemType | null> {
    const { id, operatorId, operatorName, reason, ...updateData } = params;

    const problemType = await ProblemType.findByPk(id);
    if (!problemType) {
      return null;
    }

    const oldData = problemType.toJSON();
    await problemType.update(updateData);

    for (const [key, value] of Object.entries(updateData)) {
      if (oldData[key as keyof typeof oldData] !== value) {
        await ModificationHistory.create({
          id: uuidv4(),
          entityType: EntityType.PROBLEM_TYPE,
          entityId: id,
          fieldName: key,
          oldValue: String(oldData[key as keyof typeof oldData] || ''),
          newValue: String(value || ''),
          modifiedBy: operatorId,
          modifiedByName: operatorName,
          reason: reason || '更新问题类型信息'
        });
      }
    }

    return problemType;
  }

  async validateProblemType(problemTypeId: string): Promise<{ valid: boolean; problemType?: ProblemType; reason?: string }> {
    const problemType = await ProblemType.findByPk(problemTypeId);

    if (!problemType) {
      return { valid: false, reason: '问题类型不存在' };
    }

    if (!problemType.isActive) {
      return { valid: false, reason: '问题类型已禁用' };
    }

    return { valid: true, problemType };
  }

  async getProblemTypeById(id: string): Promise<ProblemType | null> {
    return await ProblemType.findByPk(id);
  }

  async getActiveProblemTypes(): Promise<ProblemType[]> {
    return await ProblemType.findAll({
      where: { isActive: true },
      order: [['level', 'ASC'], ['priority', 'DESC']]
    });
  }

  async getModificationHistory(problemTypeId: string): Promise<ModificationHistory[]> {
    return await ModificationHistory.findAll({
      where: {
        entityType: EntityType.PROBLEM_TYPE,
        entityId: problemTypeId
      },
      order: [['createdAt', 'DESC']]
    });
  }
}

export default new ProblemTypeService();
