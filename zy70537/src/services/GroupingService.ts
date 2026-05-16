import { v4 as uuidv4 } from 'uuid';
import {
  TenantGroup,
  GroupStatus,
  GroupRule,
  SourceSystem,
  HitResult,
  HitDetail,
  RuleType,
  AdjustmentRecord,
  GroupReport
} from '../models/types';
import { dataStore } from '../store/DataStore';

export class GroupingService {
  createTenantGroup(
    tenantId: string,
    sourceSystems: SourceSystem[],
    rawInput: Record<string, unknown>
  ): TenantGroup {
    const existingGroup = dataStore.getTenantGroupByRequestId(
      rawInput.requestId as string
    );
    if (existingGroup) {
      return existingGroup;
    }

    const now = Date.now();
    const group: TenantGroup = {
      tenantId,
      groupId: uuidv4(),
      requestId: rawInput.requestId as string || uuidv4(),
      sourceSystems,
      mergedRules: [],
      hitResults: [],
      finalResult: null,
      status: GroupStatus.PENDING,
      adjustmentRecords: [],
      rawInput,
      processingBasis: ['初始创建'],
      createdAt: now,
      updatedAt: now
    };

    dataStore.saveTenantGroup(group);
    return group;
  }

  createFailedTenantGroup(
    tenantId: string,
    sourceSystems: SourceSystem[],
    rawInput: Record<string, unknown>,
    errors: string[]
  ): TenantGroup {
    const now = Date.now();
    const group: TenantGroup = {
      tenantId,
      groupId: uuidv4(),
      requestId: rawInput.requestId as string || uuidv4(),
      sourceSystems,
      mergedRules: [],
      hitResults: [],
      finalResult: false,
      status: GroupStatus.FAILED,
      adjustmentRecords: [],
      rawInput,
      processingBasis: [
        '输入校验失败',
        `错误详情: ${JSON.stringify(errors)}`,
        '最终结论: 拒绝处理'
      ],
      errorMessage: errors.join('; '),
      createdAt: now,
      updatedAt: now
    };

    dataStore.saveTenantGroup(group);
    return group;
  }

  private getRuleKey(rule: GroupRule): string {
    const valueStr = typeof rule.ruleValue === 'object'
      ? JSON.stringify(rule.ruleValue)
      : String(rule.ruleValue);
    return `${rule.ruleType}-${valueStr}`;
  }

  mergeRules(groupId: string): GroupRule[] {
    const group = this.getGroupOrThrow(groupId);
    const mergedRules: GroupRule[] = [];
    const ruleMap = new Map<string, GroupRule>();

    group.processingBasis.push(`开始规则合并，${group.sourceSystems.length}个来源系统`);

    for (const sourceSystem of group.sourceSystems) {
      for (const rule of sourceSystem.rules) {
        const ruleKey = this.getRuleKey(rule);
        if (!ruleMap.has(ruleKey)) {
          ruleMap.set(ruleKey, rule);
          mergedRules.push(rule);
        }
      }
      group.processingBasis.push(`合并来源系统 ${sourceSystem.systemName} 的 ${sourceSystem.rules.length} 条规则`);
    }

    group.mergedRules = mergedRules;
    group.updatedAt = Date.now();
    dataStore.saveTenantGroup(group);

    return mergedRules;
  }

  calculateHit(groupId: string, tenantAttributes: Record<string, unknown>): HitResult[] {
    const group = this.getGroupOrThrow(groupId);
    group.status = GroupStatus.PROCESSING;
    group.processingBasis.push('开始命中计算');
    dataStore.saveTenantGroup(group);

    const hitResults: HitResult[] = [];

    try {
      for (const sourceSystem of group.sourceSystems) {
        const hitDetails: HitDetail[] = [];

        for (const rule of sourceSystem.rules) {
          const hitDetail = this.evaluateRule(rule, tenantAttributes);
          hitDetails.push(hitDetail);
        }

        const hitCount = hitDetails.filter(h => h.hit).length;
        const overallHit = hitCount > 0;
        const confidence = hitDetails.length > 0 ? hitCount / hitDetails.length : 0;

        hitResults.push({
          sourceSystemId: sourceSystem.systemId,
          hitDetails,
          overallHit,
          confidence
        });

        group.processingBasis.push(
          `来源系统 ${sourceSystem.systemName}: ${hitCount}/${hitDetails.length} 条规则命中`
        );
      }

      group.hitResults = hitResults;
      group.finalResult = this.calculateFinalResult(hitResults);
      group.status = GroupStatus.SUCCESS;
      group.updatedAt = Date.now();
      dataStore.saveTenantGroup(group);

      return hitResults;
    } catch (error) {
      group.status = GroupStatus.FAILED;
      group.errorMessage = error instanceof Error ? error.message : '未知错误';
      group.processingBasis.push(`计算失败: ${group.errorMessage}`);
      group.updatedAt = Date.now();
      dataStore.saveTenantGroup(group);
      throw error;
    }
  }

  private evaluateRule(rule: GroupRule, tenantAttributes: Record<string, unknown>): HitDetail {
    let hit = false;
    let explanation = '';

    switch (rule.ruleType) {
      case RuleType.WHITELIST:
        hit = String(tenantAttributes.tenantId) === String(rule.ruleValue);
        explanation = hit
          ? `租户在白名单中: ${rule.ruleValue}`
          : `租户不在白名单中: ${rule.ruleValue}`;
        break;

      case RuleType.BLACKLIST:
        hit = String(tenantAttributes.tenantId) === String(rule.ruleValue);
        explanation = hit
          ? `租户在黑名单中: ${rule.ruleValue}`
          : `租户不在黑名单中: ${rule.ruleValue}`;
        break;

      case RuleType.PERCENTAGE:
        const percentage = Number(rule.ruleValue);
        const tenantHash = this.hashString(String(tenantAttributes.tenantId));
        const tenantPercent = (tenantHash % 10000) / 100;
        hit = tenantPercent < percentage;
        explanation = hit
          ? `租户百分比 ${tenantPercent.toFixed(2)}% < ${percentage}%，命中`
          : `租户百分比 ${tenantPercent.toFixed(2)}% >= ${percentage}%，未命中`;
        break;

      case RuleType.ATTRIBUTE:
        const attrRule = rule.ruleValue as Record<string, unknown>;
        const attrKey = String(attrRule.key);
        const attrValue = String(attrRule.value);
        const tenantValue = String(tenantAttributes[attrKey] || '');
        hit = tenantValue === attrValue;
        explanation = hit
          ? `属性 ${attrKey}=${tenantValue} 匹配规则值 ${attrValue}`
          : `属性 ${attrKey}=${tenantValue} 不匹配规则值 ${attrValue}`;
        break;

      default:
        explanation = `未知规则类型: ${rule.ruleType}`;
    }

    return { ruleId: rule.ruleId, hit, explanation };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private calculateFinalResult(hitResults: HitResult[]): boolean {
    if (hitResults.length === 0) return false;

    const hitSystems = hitResults.filter(r => r.overallHit).length;
    const majority = Math.ceil(hitResults.length / 2);
    return hitSystems >= majority;
  }

  manualAdjustment(
    groupId: string,
    operator: string,
    newResult: boolean,
    reason: string
  ): TenantGroup {
    const group = this.getGroupOrThrow(groupId);

    const adjustment: AdjustmentRecord = {
      adjustmentId: uuidv4(),
      operator,
      operationType: 'OVERRIDE',
      beforeValue: group.finalResult!,
      afterValue: newResult,
      reason,
      timestamp: Date.now()
    };

    group.adjustmentRecords.push(adjustment);
    group.finalResult = newResult;
    group.status = GroupStatus.SUCCESS;
    group.processingBasis.push(`人工修正: ${operator} 将结果从 ${adjustment.beforeValue} 改为 ${newResult}，原因: ${reason}`);
    group.updatedAt = Date.now();
    dataStore.saveTenantGroup(group);

    return group;
  }

  recalculateAfterAdjustment(groupId: string, tenantAttributes: Record<string, unknown>): HitResult[] {
    const group = this.getGroupOrThrow(groupId);
    group.processingBasis.push('人工修正后重新计算');
    dataStore.saveTenantGroup(group);

    return this.calculateHit(groupId, tenantAttributes);
  }

  advanceStatus(groupId: string, newStatus: GroupStatus): TenantGroup {
    const group = this.getGroupOrThrow(groupId);
    group.status = newStatus;
    group.processingBasis.push(`状态变更为: ${newStatus}`);
    group.updatedAt = Date.now();
    dataStore.saveTenantGroup(group);
    return group;
  }

  handleException(groupId: string, errorMessage: string): TenantGroup {
    const group = this.getGroupOrThrow(groupId);
    group.status = GroupStatus.MANUAL_REVIEW;
    group.errorMessage = errorMessage;
    group.processingBasis.push(`异常处理: ${errorMessage}，转入人工审核`);
    group.updatedAt = Date.now();
    dataStore.saveTenantGroup(group);
    return group;
  }

  generateReport(groupId: string): GroupReport {
    const group = this.getGroupOrThrow(groupId);

    const sourceSummary = group.sourceSystems.map(sys => {
      const hitResult = group.hitResults.find(r => r.sourceSystemId === sys.systemId);
      return {
        systemId: sys.systemId,
        systemName: sys.systemName,
        hitCount: hitResult?.hitDetails.filter(h => h.hit).length || 0,
        totalRules: sys.rules.length
      };
    });

    const report: GroupReport = {
      reportId: uuidv4(),
      groupId,
      tenantId: group.tenantId,
      finalResult: group.finalResult,
      status: group.status,
      sourceSummary,
      adjustmentCount: group.adjustmentRecords.length,
      generatedAt: Date.now()
    };

    dataStore.saveReport(report);
    return report;
  }

  exportReport(reportId: string): string {
    const report = dataStore.getReport(reportId);
    if (!report) {
      throw new Error(`报告不存在: ${reportId}`);
    }

    const csvContent = this.generateCSVContent(report);
    report.exportContent = csvContent;
    dataStore.saveReport(report);
    return csvContent;
  }

  private generateCSVContent(report: GroupReport): string {
    const headers = [
      '报告ID',
      '分组ID',
      '租户ID',
      '最终结果',
      '状态',
      '调整次数',
      '生成时间',
      '来源系统详情'
    ];

    const sourceDetails = report.sourceSummary
      .map(s => `${s.systemName}(命中${s.hitCount}/${s.totalRules})`)
      .join('; ');

    const row = [
      report.reportId,
      report.groupId,
      report.tenantId,
      report.finalResult?.toString() || '',
      report.status,
      report.adjustmentCount.toString(),
      new Date(report.generatedAt).toISOString(),
      sourceDetails
    ];

    return `${headers.join(',')}\n${row.join(',')}`;
  }

  getTenantGroup(groupId: string): TenantGroup | undefined {
    return dataStore.getTenantGroup(groupId);
  }

  getTenantGroupsByTenantId(tenantId: string): TenantGroup[] {
    return dataStore.getTenantGroupsByTenantId(tenantId);
  }

  getAllTenantGroups(): TenantGroup[] {
    return dataStore.getAllTenantGroups();
  }

  private getGroupOrThrow(groupId: string): TenantGroup {
    const group = dataStore.getTenantGroup(groupId);
    if (!group) {
      throw new Error(`分组不存在: ${groupId}`);
    }
    return group;
  }

  validateInput(input: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.tenantId || typeof input.tenantId !== 'string' || input.tenantId.trim() === '') {
      errors.push('tenantId 不能为空且必须是字符串');
    }

    if (!input.sourceSystems || !Array.isArray(input.sourceSystems)) {
      errors.push('sourceSystems 不能为空且必须是数组');
    } else {
      for (let i = 0; i < input.sourceSystems.length; i++) {
        const sys = input.sourceSystems[i] as Record<string, unknown>;
        if (!sys.systemId || typeof sys.systemId !== 'string') {
          errors.push(`来源系统[${i}]缺少有效的systemId`);
        }
        if (!sys.rules || !Array.isArray(sys.rules)) {
          errors.push(`来源系统[${i}]缺少有效的rules数组`);
        } else {
          for (let j = 0; j < sys.rules.length; j++) {
            const rule = sys.rules[j] as Record<string, unknown>;
            if (!rule.ruleId || !rule.ruleType) {
              errors.push(`来源系统[${i}]的规则[${j}]缺少ruleId或ruleType`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const groupingService = new GroupingService();
