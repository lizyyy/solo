import { SamplingRule } from '../models';
import { SamplingMethod } from '../models/SamplingRule';

export class RuleService {
  async createRule(data: {
    name: string;
    description?: string;
    method: SamplingMethod;
    sampleSize: number;
    sampleRate?: number;
    stratifyField?: string;
    filterConditions?: Record<string, any>;
    createdBy: string;
  }): Promise<SamplingRule> {
    return SamplingRule.create({
      ...data,
      isActive: true,
    });
  }

  async getRuleById(ruleId: string): Promise<SamplingRule | null> {
    return SamplingRule.findByPk(ruleId);
  }

  async listRules(params?: {
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: SamplingRule[]; count: number }> {
    const { isActive, page = 1, pageSize = 20 } = params || {};
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return SamplingRule.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['createdAt', 'DESC']],
    });
  }

  async updateRule(
    ruleId: string,
    data: Partial<{
      name: string;
      description: string;
      method: SamplingMethod;
      sampleSize: number;
      sampleRate: number;
      stratifyField: string;
      filterConditions: Record<string, any>;
      isActive: boolean;
    }>
  ): Promise<SamplingRule> {
    const rule = await SamplingRule.findByPk(ruleId);
    if (!rule) {
      throw new Error('抽样规则不存在');
    }
    return rule.update(data);
  }

  async deleteRule(ruleId: string): Promise<void> {
    const rule = await SamplingRule.findByPk(ruleId);
    if (!rule) {
      throw new Error('抽样规则不存在');
    }
    await rule.destroy();
  }
}
