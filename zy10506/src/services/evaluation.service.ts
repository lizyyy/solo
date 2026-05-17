import { v4 as uuidv4 } from 'uuid';
import {
  EvaluationContext,
  ExplanationReport,
  EvaluationStatus,
  OverrideSource,
  OverrideLink,
  FeatureFlag,
  UserGroup,
  EnvironmentRule,
  CreateExplanationRequest,
  ManualCorrectionRequest
} from '../models/types';
import { dataStore } from '../data/store';

class EvaluationService {
  async createExplanation(request: CreateExplanationRequest): Promise<ExplanationReport> {
    const rawInput = JSON.stringify(request);
    const context: EvaluationContext = {
      flagName: request.flagName,
      tenantId: request.tenantId,
      userId: request.userId,
      email: request.email,
      environment: request.environment,
      attributes: request.attributes || {},
      timestamp: new Date()
    };

    const report = dataStore.createReport(context, rawInput);
    this.evaluateFlag(report.id).catch(error => {
      this.handleEvaluationError(report.id, error, 'createExplanation');
    });

    return report;
  }

  async evaluateFlag(reportId: string): Promise<void> {
    const report = dataStore.getReport(reportId);
    if (!report) {
      throw new Error(`报告不存在: ${reportId}`);
    }

    try {
      dataStore.updateReport(reportId, { status: EvaluationStatus.MATCHING });
      dataStore.addProcessingLog(reportId, '开始评估功能开关命中情况');

      const flag = dataStore.getFlag(report.context.flagName);
      if (!flag) {
        throw new Error(`功能开关不存在: ${report.context.flagName}`);
      }

      dataStore.addProcessingLog(reportId, `找到功能开关: ${flag.name}, 默认值: ${flag.defaultValue}`);

      let currentValue = flag.defaultValue;
      dataStore.addOverrideLink(reportId, {
        source: OverrideSource.DEFAULT,
        sourceId: flag.id,
        sourceName: '系统默认值',
        previousValue: false,
        newValue: currentValue,
        reason: '使用开关默认值',
        timestamp: new Date()
      });

      currentValue = await this.evaluateEnvironmentRules(reportId, flag, report.context, currentValue);
      currentValue = await this.evaluateUserGroups(reportId, flag, report.context, currentValue);
      currentValue = await this.evaluateRollout(reportId, flag, report.context, currentValue);

      dataStore.updateReport(reportId, {
        status: EvaluationStatus.EVALUATED,
        finalValue: currentValue
      });
      dataStore.addProcessingLog(reportId, `评估完成，最终值: ${currentValue}`);

    } catch (error) {
      this.handleEvaluationError(reportId, error, 'evaluateFlag');
      throw error;
    }
  }

  private async evaluateEnvironmentRules(
    reportId: string,
    flag: FeatureFlag,
    context: EvaluationContext,
    currentValue: boolean
  ): Promise<boolean> {
    dataStore.addProcessingLog(reportId, '开始匹配环境规则...');

    const matchedRules = flag.environmentRules
      .filter(rule => rule.enabled)
      .filter(rule => rule.environment === '*' || rule.environment === context.environment)
      .sort((a, b) => b.priority - a.priority);

    if (matchedRules.length === 0) {
      dataStore.addProcessingLog(reportId, '未匹配到任何环境规则');
      return currentValue;
    }

    for (const rule of matchedRules) {
      dataStore.addProcessingLog(reportId, `匹配到环境规则: ${rule.name}, 优先级: ${rule.priority}`);
      
      const ruleValue = rule.conditions.enabled !== undefined ? rule.conditions.enabled : currentValue;
      if (ruleValue !== currentValue) {
        dataStore.addOverrideLink(reportId, {
          source: OverrideSource.ENVIRONMENT,
          sourceId: rule.id,
          sourceName: rule.name,
          previousValue: currentValue,
          newValue: ruleValue,
          reason: `环境规则匹配: ${context.environment}`,
          timestamp: new Date()
        });
        currentValue = ruleValue;
        dataStore.addProcessingLog(reportId, `环境规则覆盖值: ${currentValue}`);
      }
    }

    const matchedRuleIds = matchedRules.map(r => r.id);
    dataStore.updateReport(reportId, { matchedRules: matchedRuleIds });

    return currentValue;
  }

  private async evaluateUserGroups(
    reportId: string,
    flag: FeatureFlag,
    context: EvaluationContext,
    currentValue: boolean
  ): Promise<boolean> {
    dataStore.addProcessingLog(reportId, '开始匹配用户分组...');

    const matchedGroups = flag.userGroups
      .filter(group => group.enabled)
      .filter(group => this.matchUserGroup(group, context))
      .sort((a, b) => b.priority - a.priority);

    if (matchedGroups.length === 0) {
      dataStore.addProcessingLog(reportId, '未匹配到任何用户分组');
      return currentValue;
    }

    for (const group of matchedGroups) {
      dataStore.addProcessingLog(reportId, `匹配到用户分组: ${group.name}, 优先级: ${group.priority}`);
      
      if (currentValue !== true) {
        dataStore.addOverrideLink(reportId, {
          source: OverrideSource.USER_GROUP,
          sourceId: group.id,
          sourceName: group.name,
          previousValue: currentValue,
          newValue: true,
          reason: `用户归属分组: ${group.name}`,
          timestamp: new Date()
        });
        currentValue = true;
        dataStore.addProcessingLog(reportId, `用户分组覆盖值: ${currentValue}`);
      }
    }

    const matchedGroupIds = matchedGroups.map(g => g.id);
    dataStore.updateReport(reportId, { matchedGroups: matchedGroupIds });

    return currentValue;
  }

  private matchUserGroup(group: UserGroup, context: EvaluationContext): boolean {
    if (group.conditions.userIds && context.userId) {
      if (group.conditions.userIds.includes(context.userId)) {
        return true;
      }
    }

    if (group.conditions.emails && context.email) {
      if (group.conditions.emails.includes(context.email)) {
        return true;
      }
    }

    if (group.conditions.domains && context.email) {
      const domain = context.email.split('@')[1];
      if (domain && group.conditions.domains.includes(domain)) {
        return true;
      }
    }

    if (group.conditions.attributes) {
      for (const [key, values] of Object.entries(group.conditions.attributes)) {
        const userValue = context.attributes[key];
        if (userValue && Array.isArray(values) && values.includes(userValue)) {
          return true;
        }
      }
    }

    return false;
  }

  private async evaluateRollout(
    reportId: string,
    flag: FeatureFlag,
    context: EvaluationContext,
    currentValue: boolean
  ): Promise<boolean> {
    if (flag.rolloutPercentage === undefined || flag.rolloutPercentage >= 100) {
      return currentValue;
    }

    dataStore.addProcessingLog(reportId, `检查灰度发布规则: ${flag.rolloutPercentage}%`);

    const hash = this.consistentHash(context.userId || context.tenantId, flag.name);
    const isInRollout = hash < flag.rolloutPercentage;

    if (isInRollout && !currentValue) {
      dataStore.addOverrideLink(reportId, {
        source: OverrideSource.ROLLOUT,
        sourceId: flag.id,
        sourceName: '灰度发布',
        previousValue: currentValue,
        newValue: true,
        reason: `用户命中灰度发布: ${flag.rolloutPercentage}%, 哈希值: ${hash.toFixed(2)}`,
        timestamp: new Date()
      });
      currentValue = true;
      dataStore.addProcessingLog(reportId, `灰度发布覆盖值: ${currentValue}`);
    }

    return currentValue;
  }

  private consistentHash(key: string, seed: string): number {
    let hash = 0;
    const combined = key + seed;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  async manualCorrect(request: ManualCorrectionRequest): Promise<ExplanationReport> {
    const report = dataStore.getReport(request.reportId);
    if (!report) {
      throw new Error(`报告不存在: ${request.reportId}`);
    }

    const originalValue = report.finalValue;

    dataStore.addOverrideLink(request.reportId, {
      source: OverrideSource.MANUAL,
      sourceId: request.correctedBy,
      sourceName: '人工修正',
      previousValue: originalValue,
      newValue: request.correctedValue,
      reason: request.correctionReason,
      timestamp: new Date()
    });

    dataStore.updateReport(request.reportId, {
      status: EvaluationStatus.MANUALLY_CORRECTED,
      finalValue: request.correctedValue,
      manualCorrection: {
        correctedBy: request.correctedBy,
        correctionReason: request.correctionReason,
        correctedAt: new Date(),
        originalValue
      }
    });

    dataStore.addProcessingLog(request.reportId, 
      `人工修正: ${originalValue} -> ${request.correctedValue}, 操作人: ${request.correctedBy}, 原因: ${request.correctionReason}`
    );

    const updatedReport = dataStore.getReport(request.reportId);
    if (!updatedReport) {
      throw new Error('更新报告失败');
    }
    return updatedReport;
  }

  private handleEvaluationError(reportId: string, error: unknown, step: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    dataStore.updateReport(reportId, {
      status: EvaluationStatus.ERROR,
      error: {
        message: errorMessage,
        stack: errorStack,
        step
      }
    });
    dataStore.addProcessingLog(reportId, `错误发生在 [${step}]: ${errorMessage}`);
  }

  async getReport(reportId: string): Promise<ExplanationReport | undefined> {
    return dataStore.getReport(reportId);
  }

  async queryReports(params: {
    flagName?: string;
    tenantId?: string;
    userId?: string;
    status?: EvaluationStatus;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: ExplanationReport[]; total: number }> {
    return dataStore.queryReports(params);
  }

  async getAllReports(): Promise<ExplanationReport[]> {
    return dataStore.getAllReports();
  }

  async getFlag(flagName: string): Promise<FeatureFlag | undefined> {
    return dataStore.getFlag(flagName);
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return dataStore.getAllFlags();
  }

  async advanceStatus(reportId: string, targetStatus: EvaluationStatus): Promise<ExplanationReport> {
    const report = dataStore.getReport(reportId);
    if (!report) {
      throw new Error(`报告不存在: ${reportId}`);
    }

    const validTransitions: Record<EvaluationStatus, EvaluationStatus[]> = {
      [EvaluationStatus.PENDING]: [EvaluationStatus.MATCHING],
      [EvaluationStatus.MATCHING]: [EvaluationStatus.EVALUATED, EvaluationStatus.ERROR],
      [EvaluationStatus.EVALUATED]: [EvaluationStatus.MANUALLY_CORRECTED],
      [EvaluationStatus.ERROR]: [EvaluationStatus.MANUALLY_CORRECTED, EvaluationStatus.EVALUATED],
      [EvaluationStatus.MANUALLY_CORRECTED]: []
    };

    const allowedTransitions = validTransitions[report.status];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new Error(`无效的状态转换: ${report.status} -> ${targetStatus}`);
    }

    if (targetStatus === EvaluationStatus.EVALUATED) {
      await this.evaluateFlag(reportId);
    } else {
      dataStore.updateReport(reportId, { status: targetStatus });
      dataStore.addProcessingLog(reportId, `状态手动推进: ${report.status} -> ${targetStatus}`);
    }

    const updatedReport = dataStore.getReport(reportId);
    if (!updatedReport) {
      throw new Error('更新报告失败');
    }
    return updatedReport;
  }
}

export const evaluationService = new EvaluationService();
