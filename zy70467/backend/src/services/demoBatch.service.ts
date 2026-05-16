import { v4 as uuidv4 } from 'uuid';
import { inMemoryDb, InMemoryBatch, InMemoryRule } from '../utils/inMemoryDb';
import logger from '../utils/logger';
import { 
  TrainingEnvironmentItem, 
  RuleLogic, 
  ValidationError,
  RuleDefinition,
  RuleCondition,
  RuleOperator
} from '../models';

export class DemoBatchService {
  private currentRuleVersion: number = 1;
  private rules: Map<number, RuleLogic> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    this.rules.set(1, this.getDefaultRuleLogic(1));
    this.rules.set(2, this.getStrictRuleLogic(2));
  }

  getDefaultRuleLogic(version: number): RuleLogic {
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
    const baseRules = this.getDefaultRuleLogic(version).rules;
    return {
      version,
      description: '严格审批校验规则 v' + version,
      rules: [
        ...baseRules,
        {
          id: 'RULE_005',
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
      ruleLogic = this.getDefaultRuleLogic(ruleLogic?.version || 1);
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

  switchRuleVersion(version: number): boolean {
    if (this.rules.has(version)) {
      this.currentRuleVersion = version;
      logger.info(`[演示模式] 已切换到规则版本 v${version}`);
      return true;
    }
    return false;
  }

  getCurrentRuleLogic(): RuleLogic {
    return this.rules.get(this.currentRuleVersion) || this.getDefaultRuleLogic(1);
  }

  getRuleLogicByVersion(version: number): RuleLogic | undefined {
    return this.rules.get(version);
  }

  getAllRuleVersions(): Array<{ version: number; description: string; ruleCount: number }> {
    return Array.from(this.rules.entries()).map(([version, logic]) => ({
      version,
      description: logic.description,
      ruleCount: logic.rules.length
    }));
  }

  async createBatch(data: {
    name: string;
    description?: string;
    inputData: any[];
    createdBy: string;
  }) {
    logger.info(`[演示模式] 创建批次: ${data.name}, 数据量: ${data.inputData.length}, 使用规则版本 v${this.currentRuleVersion}`);

    const batch = inMemoryDb.createBatch({
      ...data,
      ruleVersionId: `demo-rule-v${this.currentRuleVersion}`,
    });

    return batch;
  }

  async executeBatch(batchId: string) {
    logger.info(`[演示模式] 执行批次: ${batchId}, 使用规则版本 v${this.currentRuleVersion}`);
    const startTime = Date.now();

    const batch = inMemoryDb.getBatchById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.status !== 'PENDING') {
      throw new Error('批次已执行或正在处理中');
    }

    inMemoryDb.updateBatch(batchId, { status: 'PROCESSING' });

    const ruleLogic = this.getCurrentRuleLogic();
    let successCount = 0;
    let failedCount = 0;
    const failedItems: any[] = [];

    for (const item of batch.items) {
      const originalData = item.originalData;
      const errors = this.validateItem(originalData, ruleLogic);
      const hasBlocker = this.hasBlockerErrors(errors);

      if (hasBlocker || errors.length > 0) {
        failedCount++;
        inMemoryDb.updateBatchItem(batchId, item.id, {
          status: 'FAILED',
          isFailed: true,
          validationErrors: errors,
          processedAt: new Date(),
        });

        const failureReason = errors.find((e: any) => e.severity === 'BLOCKER')?.message || '存在验证错误';
        failedItems.push({
          itemId: item.id,
          originalData,
          failureReason,
          errors,
        });

        inMemoryDb.createFailedItem({
          batchId,
          batchItemId: item.id,
          originalData,
          failureReason,
          errorDetails: errors,
          reviewStatus: 'PENDING',
        });
      } else {
        successCount++;
        inMemoryDb.updateBatchItem(batchId, item.id, {
          status: 'SUCCESS',
          isFailed: false,
          processedData: originalData,
          processedAt: new Date(),
        });
      }
    }

    const partialSuccess = successCount > 0 && failedCount > 0;
    let finalStatus: InMemoryBatch['status'];

    if (failedCount === 0) {
      finalStatus = 'SUCCESS';
    } else if (successCount === 0) {
      finalStatus = 'FAILED';
    } else {
      finalStatus = 'PARTIAL_SUCCESS';
    }

    const executionTimeMs = Date.now() - startTime;

    const updatedBatch = inMemoryDb.updateBatch(batchId, {
      status: finalStatus,
      successCount,
      failedCount,
      partialSuccess,
      executionTimeMs,
      executedAt: new Date(),
    });

    inMemoryDb.addAuditLog({
      batchId,
      action: 'BATCH_EXECUTED',
      operator: 'SYSTEM',
      afterData: {
        status: finalStatus,
        successCount,
        failedCount,
        executionTimeMs,
        ruleVersion: this.currentRuleVersion,
      },
      comment: `批次执行完成，成功: ${successCount}, 失败: ${failedCount}, 使用规则 v${this.currentRuleVersion}`,
    });

    logger.info(`[演示模式] 批次执行完成: ${batchId}, 状态: ${finalStatus}, 耗时: ${executionTimeMs}ms`);

    return {
      batchId: updatedBatch?.id,
      status: finalStatus,
      totalCount: updatedBatch?.totalCount,
      successCount,
      failedCount,
      partialSuccess,
      executionTimeMs,
      failedItems,
      ruleVersion: this.currentRuleVersion,
      ruleDescription: ruleLogic.description,
    };
  }

  async getBatchList(params: { page?: number; pageSize?: number; status?: string }) {
    return inMemoryDb.getBatches(params);
  }

  async getBatchDetail(batchId: string) {
    const batch = inMemoryDb.getBatchById(batchId);
    if (!batch) return null;
    
    const failedItems = inMemoryDb.getFailedItemsByBatch(batchId);
    const auditLogs = inMemoryDb.getAuditLogs({ batchId }).data;
    const ruleVersionMatch = batch.ruleVersionId.match(/v(\d+)/);
    const ruleVersion = ruleVersionMatch ? parseInt(ruleVersionMatch[1]) : 1;
    const ruleLogic = this.getRuleLogicByVersion(ruleVersion);

    return {
      ...batch,
      failedItems,
      auditLogs,
      ruleVersion,
      ruleLogic: ruleLogic,
      ruleExplanation: ruleLogic ? this.explainRuleLogic(ruleLogic) : '无法获取规则解释',
    };
  }

  async generateReport(batchId: string) {
    const batch = await this.getBatchDetail(batchId);
    if (!batch) throw new Error('批次不存在');

    const nextSteps: string[] = [];
    if (batch.status === 'PENDING') {
      nextSteps.push('请执行批次处理以验证数据');
    }
    if (batch.failedCount > 0) {
      nextSteps.push(`有 ${batch.failedCount} 条数据验证失败，请查看失败项`);
      nextSteps.push('建议先处理 BLOCKER 级别的错误（如：审批意见缺失）');
      nextSteps.push('对失败项进行人工复核后，可重新提交处理');
    }
    if (batch.partialSuccess) {
      nextSteps.push('部分数据验证通过，建议完成失败项处理后统一推进');
    }
    if (batch.status === 'SUCCESS') {
      nextSteps.push('所有数据验证通过，可以进入下一流程');
    }
    nextSteps.push(`本次处理使用规则版本: v${batch.ruleVersion} - ${batch.ruleLogic?.description}`);

    return {
      batchId,
      beforeProcessing: batch.items.map((i: any) => i.originalData),
      afterProcessing: batch.items.filter((i: any) => i.status === 'SUCCESS').map((i: any) => i.processedData),
      executionTime: batch.executionTimeMs || 0,
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      partialSuccess: batch.partialSuccess,
      nextSteps,
      failedItems: batch.failedItems,
      ruleVersion: batch.ruleVersion,
      ruleLogicSnapshot: batch.ruleLogic,
      ruleExplanation: batch.ruleExplanation,
    };
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

  async submitReview(data: {
    batchId: string;
    itemId: string;
    reviewComment: string;
    reviewedBy: string;
    decision: 'APPROVED' | 'REJECTED' | 'NEED_MORE_INFO';
  }) {
    const failedItem = inMemoryDb.getFailedItemsByBatch(data.batchId).find(f => f.id === data.itemId);
    if (!failedItem) {
      throw new Error('失败记录不存在');
    }

    const updated = inMemoryDb.updateFailedItem(data.itemId, {
      reviewStatus: data.decision === 'APPROVED' ? 'APPROVED' : data.decision === 'REJECTED' ? 'REJECTED' : 'PENDING',
      reviewComment: data.reviewComment,
      reviewedBy: data.reviewedBy,
      reviewedAt: new Date(),
    });

    inMemoryDb.addAuditLog({
      batchId: data.batchId,
      batchItemId: failedItem.batchItemId,
      action: 'REVIEW_SUBMITTED',
      operator: data.reviewedBy,
      beforeData: {
        reviewStatus: failedItem.reviewStatus,
        reviewComment: failedItem.reviewComment,
      },
      afterData: {
        reviewStatus: updated?.reviewStatus,
        reviewComment: updated?.reviewComment,
        decision: data.decision,
      },
      comment: `复核决策: ${data.decision}, 意见: ${data.reviewComment}`,
    });

    return updated;
  }

  getActiveRule() {
    return {
      version: this.currentRuleVersion,
      logic: this.getCurrentRuleLogic(),
    };
  }

  getAllRules() {
    return this.getAllRuleVersions();
  }

  getAuditLogs(params: { batchId?: string; page?: number; pageSize?: number }) {
    return inMemoryDb.getAuditLogs(params);
  }
}

export const demoBatchService = new DemoBatchService();
