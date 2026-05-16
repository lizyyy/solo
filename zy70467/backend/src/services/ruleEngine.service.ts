import prisma from '../utils/db';
import logger from '../utils/logger';
import { 
  TrainingEnvironmentItem, 
  ValidationError, 
  RuleLogic,
  RuleDefinition,
  RuleCondition,
  RuleOperator
} from '../models';

export class RuleEngineService {
  async getActiveRuleVersion() {
    logger.info('获取当前激活的规则版本');
    const rule = await prisma.ruleVersion.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { version: 'desc' },
    });
    return rule;
  }

  async createRuleVersion(data: {
    name: string;
    description: string;
    logic: RuleLogic;
    createdBy: string;
  }) {
    logger.info(`创建新规则版本: ${data.name}`);
    
    const lastVersion = await prisma.ruleVersion.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    
    const newVersion = (lastVersion?.version || 0) + 1;
    
    await prisma.ruleVersion.updateMany({
      where: { status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    });
    
    const ruleLogicWithVersion: RuleLogic = {
      ...data.logic,
      version: newVersion
    };
    
    const rule = await prisma.ruleVersion.create({
      data: {
        name: data.name,
        description: data.description,
        version: newVersion,
        logic: ruleLogicWithVersion as any,
        createdBy: data.createdBy,
      },
    });
    
    logger.info(`规则版本 ${newVersion} 已创建并激活`);
    return rule;
  }

  async getRuleVersionById(id: string) {
    return prisma.ruleVersion.findUnique({ where: { id } });
  }

  async getAllRuleVersions() {
    return prisma.ruleVersion.findMany({
      orderBy: { version: 'desc' },
    });
  }

  async toggleRuleStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    logger.info(`切换规则状态: ${id} -> ${status}`);
    
    if (status === 'ACTIVE') {
      await prisma.ruleVersion.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      });
    }

    return prisma.ruleVersion.update({
      where: { id },
      data: { status },
    });
  }

  getDefaultRuleLogic(version: number = 1): RuleLogic {
    return {
      version,
      description: '默认审批校验规则 v' + version,
      rules: [
        {
          id: 'RULE_001',
          name: '审批通过时意见不能为空',
          description: '当审批状态为已通过时，审批意见不能为空',
          conditionMode: 'AND' as const,
          conditions: [
            { field: 'approvalStatus', operator: 'equals' as RuleOperator, value: 'APPROVED' },
            { field: 'approvalComment', operator: 'isEmpty' as RuleOperator }
          ],
          action: {
            type: 'ADD_ERROR' as const,
            severity: 'BLOCKER',
            field: 'approvalComment',
            errorCode: 'APPROVAL_COMMENT_MISSING_ON_APPROVE',
            message: '审批通过时必须填写审批意见'
          }
        },
        {
          id: 'RULE_002',
          name: '审批拒绝时意见不能为空',
          description: '当审批状态为已拒绝时，审批意见不能为空',
          conditionMode: 'AND' as const,
          conditions: [
            { field: 'approvalStatus', operator: 'equals' as RuleOperator, value: 'REJECTED' },
            { field: 'approvalComment', operator: 'isEmpty' as RuleOperator }
          ],
          action: {
            type: 'ADD_ERROR' as const,
            severity: 'BLOCKER',
            field: 'approvalComment',
            errorCode: 'APPROVAL_COMMENT_MISSING_ON_REJECT',
            message: '审批拒绝时必须填写审批意见'
          }
        },
        {
          id: 'RULE_003',
          name: '提交ID不能为空',
          description: '提交记录ID是必填字段',
          conditionMode: 'AND' as const,
          conditions: [
            { field: 'submissionId', operator: 'isEmpty' as RuleOperator }
          ],
          action: {
            type: 'ADD_ERROR' as const,
            severity: 'ERROR',
            field: 'submissionId',
            errorCode: 'SUBMISSION_ID_MISSING',
            message: '提交记录ID是必填项'
          }
        },
        {
          id: 'RULE_004',
          name: '提交日期缺失警告',
          description: '建议填写提交日期',
          conditionMode: 'AND' as const,
          conditions: [
            { field: 'submittedAt', operator: 'isEmpty' as RuleOperator }
          ],
          action: {
            type: 'ADD_ERROR' as const,
            severity: 'WARNING',
            field: 'submittedAt',
            errorCode: 'SUBMISSION_DATE_MISSING',
            message: '建议填写提交日期'
          }
        }
      ]
    };
  }

  getStrictRuleLogic(version: number): RuleLogic {
    return {
      version,
      description: '严格审批校验规则 v' + version,
      rules: [
        ...this.getDefaultRuleLogic(version).rules,
        {
          id: 'RULE_005',
          name: '审批意见长度检查',
          description: '审批意见至少需要10个字符',
          conditionMode: 'AND' as const,
          conditions: [
            { field: 'approvalStatus', operator: 'in' as RuleOperator, value: ['APPROVED', 'REJECTED'] },
            { field: 'approvalComment', operator: 'notEmpty' as RuleOperator }
          ],
          action: {
            type: 'ADD_ERROR' as const,
            severity: 'WARNING',
            field: 'approvalComment',
            errorCode: 'APPROVAL_COMMENT_TOO_SHORT',
            message: '建议审批意见长度不少于10个字符'
          }
        },
        {
          id: 'RULE_006',
          name: '学员姓名不能为空',
          description: '学员姓名是必填字段',
          conditionMode: 'AND' as const,
          conditions: [
            { field: 'traineeName', operator: 'isEmpty' as RuleOperator }
          ],
          action: {
            type: 'ADD_ERROR' as const,
            severity: 'ERROR',
            field: 'traineeName',
            errorCode: 'TRAINEE_NAME_MISSING',
            message: '学员姓名不能为空'
          }
        }
      ]
    };
  }

  private evaluateCondition(item: TrainingEnvironmentItem, condition: RuleCondition): boolean {
    const fieldValue = (item as any)[condition.field];
    const { operator, value } = condition;

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'notEquals':
        return fieldValue !== value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(value);
      case 'notContains':
        return typeof fieldValue === 'string' && !fieldValue.includes(value);
      case 'isEmpty':
        return fieldValue === null 
          || fieldValue === undefined 
          || (typeof fieldValue === 'string' && fieldValue.trim() === '')
          || (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'isNotEmpty':
        return fieldValue !== null 
          && fieldValue !== undefined 
          && !(typeof fieldValue === 'string' && fieldValue.trim() === '')
          && !(Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'startsWith':
        return typeof fieldValue === 'string' && fieldValue.startsWith(value);
      case 'endsWith':
        return typeof fieldValue === 'string' && fieldValue.endsWith(value);
      case 'greaterThan':
        return typeof fieldValue === 'number' && fieldValue > value;
      case 'lessThan':
        return typeof fieldValue === 'number' && fieldValue < value;
      default:
        return false;
    }
  }

  private evaluateRuleConditions(
    item: TrainingEnvironmentItem, 
    rule: RuleDefinition
  ): boolean {
    const results = rule.conditions.map(condition => 
      this.evaluateCondition(item, condition)
    );

    if (rule.conditionMode === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  validateItem(item: TrainingEnvironmentItem, ruleLogic: RuleLogic): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!ruleLogic || !ruleLogic.rules || ruleLogic.rules.length === 0) {
      logger.warn('规则逻辑为空，使用默认校验规则');
      const defaultRules = this.getDefaultRuleLogic(ruleLogic?.version || 1);
      ruleLogic = defaultRules;
    }

    for (const rule of ruleLogic.rules) {
      const isTriggered = this.evaluateRuleConditions(item, rule);
      
      if (isTriggered) {
        logger.debug(`规则触发: ${rule.id} - ${rule.name}`);
        errors.push({
          field: rule.action.field,
          code: rule.action.errorCode,
          message: rule.action.message,
          severity: rule.action.severity
        });
      }
    }

    return errors;
  }

  hasBlockerErrors(errors: ValidationError[]): boolean {
    return errors.some(e => e.severity === 'BLOCKER');
  }

  explainRuleLogic(ruleLogic: RuleLogic): string {
    const explanations: string[] = [];
    explanations.push(`规则版本: v${ruleLogic.version}`);
    explanations.push(`规则描述: ${ruleLogic.description}`);
    explanations.push(`包含规则数: ${ruleLogic.rules.length}`);
    explanations.push('');
    
    for (const rule of ruleLogic.rules) {
      explanations.push(`【${rule.id}】${rule.name}`);
      explanations.push(`   描述: ${rule.description}`);
      explanations.push(`   条件模式: ${rule.conditionMode}`);
      
      for (const cond of rule.conditions) {
        explanations.push(`     - ${cond.field} ${cond.operator} ${cond.value !== undefined ? cond.value : ''}`);
      }
      
      explanations.push(`   动作: ${rule.action.type} [${rule.action.severity}] ${rule.action.message}`);
      explanations.push('');
    }

    return explanations.join('\n');
  }
}

export const ruleEngineService = new RuleEngineService();
