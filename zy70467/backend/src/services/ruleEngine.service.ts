import prisma from '../utils/db';
import logger from '../utils/logger';
import { TrainingEnvironmentItem, ValidationError, RuleLogic } from '../models';

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
    
    const rule = await prisma.ruleVersion.create({
      data: {
        name: data.name,
        description: data.description,
        version: newVersion,
        logic: data.logic as any,
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

  validateItem(item: TrainingEnvironmentItem, ruleLogic: RuleLogic): ValidationError[] {
    const errors: ValidationError[] = [];

    const approvalError = this.checkApprovalCommentMissing(item);
    if (approvalError) errors.push(approvalError);

    const submissionError = this.checkSubmissionValidity(item);
    if (submissionError) errors.push(submissionError);

    return errors;
  }

  private checkApprovalCommentMissing(item: TrainingEnvironmentItem): ValidationError | null {
    if (['APPROVED', 'REJECTED'].includes(item.approvalStatus)) {
      if (!item.approvalComment || item.approvalComment.trim() === '') {
        return {
          field: 'approvalComment',
          code: 'APPROVAL_COMMENT_MISSING',
          message: '审批意见为空，流程被拦截',
          severity: 'BLOCKER',
        };
      }
    }
    return null;
  }

  private checkSubmissionValidity(item: TrainingEnvironmentItem): ValidationError | null {
    if (!item.submissionId || item.submissionId.trim() === '') {
      return {
        field: 'submissionId',
        code: 'SUBMISSION_ID_MISSING',
        message: '提交记录ID缺失',
        severity: 'ERROR',
      };
    }

    if (!item.submittedAt) {
      return {
        field: 'submittedAt',
        code: 'SUBMISSION_DATE_MISSING',
        message: '提交日期缺失',
        severity: 'WARNING',
      };
    }

    return null;
  }

  hasBlockerErrors(errors: ValidationError[]): boolean {
    return errors.some(e => e.severity === 'BLOCKER');
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
}

export const ruleEngineService = new RuleEngineService();
