import {
  VulnerabilityStatus,
  Severity,
  AssignmentValidationResult,
  StatusChangeValidationResult,
  DelayRequestValidationResult,
  RiskLevel
} from '../types';

export const MAX_DELAY_COUNT = 3;
export const MIN_REASON_LENGTH = 20;
export const MAX_DELAY_DAYS = {
  [Severity.CRITICAL]: 7,
  [Severity.HIGH]: 14,
  [Severity.MEDIUM]: 30,
  [Severity.LOW]: 90
};

export const ALLOWED_STATUS_TRANSITIONS: Record<VulnerabilityStatus, VulnerabilityStatus[]> = {
  [VulnerabilityStatus.NEW]: [VulnerabilityStatus.ASSIGNED],
  [VulnerabilityStatus.ASSIGNED]: [VulnerabilityStatus.IN_PROGRESS, VulnerabilityStatus.DELAYED],
  [VulnerabilityStatus.IN_PROGRESS]: [VulnerabilityStatus.FIXED, VulnerabilityStatus.DELAYED],
  [VulnerabilityStatus.DELAYED]: [VulnerabilityStatus.IN_PROGRESS],
  [VulnerabilityStatus.FIXED]: [VulnerabilityStatus.DEPLOYED],
  [VulnerabilityStatus.DEPLOYED]: [VulnerabilityStatus.CLOSED],
  [VulnerabilityStatus.CLOSED]: []
};

export class BusinessRuleValidator {
  static validateAssignment(
    vulnerabilityStatus: VulnerabilityStatus,
    currentAssigneeId: string | null,
    assigneeId: string,
    isManualOverride: boolean = false
  ): AssignmentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!assigneeId || assigneeId.trim() === '') {
      errors.push('负责人ID不能为空');
    }

    if (vulnerabilityStatus === VulnerabilityStatus.CLOSED) {
      errors.push('已关闭的漏洞不能分配负责人');
    }

    if (vulnerabilityStatus === VulnerabilityStatus.DEPLOYED) {
      errors.push('已上线的漏洞不能重新分配负责人');
    }

    if (currentAssigneeId === assigneeId && !isManualOverride) {
      errors.push('漏洞已经分配给该负责人，重复操作无意义');
    }

    if (currentAssigneeId && currentAssigneeId !== assigneeId && !isManualOverride) {
      warnings.push('该漏洞已有其他负责人，重新分配需要确认');
    }

    const validStatuses = [
      VulnerabilityStatus.NEW,
      VulnerabilityStatus.ASSIGNED,
      VulnerabilityStatus.IN_PROGRESS,
      VulnerabilityStatus.DELAYED,
      VulnerabilityStatus.FIXED
    ];

    if (!validStatuses.includes(vulnerabilityStatus) && !isManualOverride) {
      errors.push(`漏洞当前状态 ${vulnerabilityStatus} 不允许分配负责人`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateStatusTransition(
    fromStatus: VulnerabilityStatus,
    toStatus: VulnerabilityStatus,
    assigneeId: string | null,
    manuallyCorrected: boolean,
    isManualOverride: boolean = false
  ): StatusChangeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let requiresManualOverride = false;

    if (fromStatus === toStatus) {
      return {
        valid: true,
        errors: [],
        warnings: ['状态未发生变化'],
        requiresManualOverride: false
      };
    }

    if (fromStatus === VulnerabilityStatus.CLOSED) {
      errors.push('已关闭的漏洞状态不能修改');
    }

    if (!assigneeId && toStatus !== VulnerabilityStatus.ASSIGNED && toStatus !== VulnerabilityStatus.NEW) {
      errors.push('漏洞尚未分配负责人，不能进入非待分配状态');
    }

    if (manuallyCorrected && !isManualOverride) {
      warnings.push('该漏洞状态曾被人工修正，此次修改建议添加备注说明');
    }

    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
    const isAllowedTransition = allowedTransitions.includes(toStatus);

    if (!isAllowedTransition && !isManualOverride) {
      errors.push(`状态转换不允许：${fromStatus} -> ${toStatus}。允许的转换：${allowedTransitions.join(', ') || '无'}`);
      requiresManualOverride = true;
    }

    if (toStatus === VulnerabilityStatus.CLOSED && fromStatus !== VulnerabilityStatus.DEPLOYED) {
      errors.push('只有已上线的漏洞才能关闭');
      requiresManualOverride = true;
    }

    return {
      valid: errors.length === 0 || isManualOverride,
      errors,
      warnings,
      requiresManualOverride
    };
  }

  static validateDelayRequest(
    vulnerabilityStatus: VulnerabilityStatus,
    currentDelayCount: number,
    severity: Severity,
    originalDueDate: Date,
    newDueDate: Date,
    reason: string,
    riskMitigation: string,
    isManualOverride: boolean = false
  ): DelayRequestValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
      errors.push(`延期理由至少需要 ${MIN_REASON_LENGTH} 个字符`);
    }

    if (!riskMitigation || riskMitigation.trim().length < MIN_REASON_LENGTH) {
      errors.push(`风险缓解措施至少需要 ${MIN_REASON_LENGTH} 个字符`);
    }

    if (newDueDate <= originalDueDate) {
      errors.push('新的截止日期必须晚于原截止日期');
    }

    if (newDueDate < today) {
      errors.push('新的截止日期不能早于今天');
    }

    const allowedStatuses = [
      VulnerabilityStatus.ASSIGNED,
      VulnerabilityStatus.IN_PROGRESS
    ];

    if (!allowedStatuses.includes(vulnerabilityStatus) && !isManualOverride) {
      errors.push('只有已分配或进行中的漏洞才能申请延期');
    }

    if (currentDelayCount >= MAX_DELAY_COUNT && !isManualOverride) {
      errors.push(`该漏洞已延期 ${currentDelayCount} 次，达到最大延期次数限制（${MAX_DELAY_COUNT}次）`);
    }

    const maxDelayDays = MAX_DELAY_DAYS[severity] || 30;
    const delayDays = Math.ceil((newDueDate.getTime() - originalDueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (delayDays > maxDelayDays && !isManualOverride) {
      errors.push(`${severity} 级别漏洞最多允许延期 ${maxDelayDays} 天，申请延期 ${delayDays} 天超出限制`);
    }

    let additionalRisk: RiskLevel | undefined;
    if (severity === Severity.CRITICAL && delayDays > 3) {
      additionalRisk = RiskLevel.HIGH;
      warnings.push('高危漏洞延期超过3天，风险级别将提升');
    } else if (severity === Severity.HIGH && delayDays > 7) {
      additionalRisk = RiskLevel.MEDIUM;
      warnings.push('中高危漏洞延期超过7天，需重点关注');
    }

    return {
      valid: errors.length === 0 || isManualOverride,
      errors,
      warnings,
      additionalRisk
    };
  }

  static calculateRepairWindow(
    severity: Severity,
    discoveredDate: Date = new Date()
  ): { dueDate: Date; recommendedDays: number; description: string } {
    const repairWindows: Record<Severity, { days: number; description: string }> = {
      [Severity.CRITICAL]: { days: 7, description: '高危漏洞：7天内必须修复' },
      [Severity.HIGH]: { days: 14, description: '中高危漏洞：14天内必须修复' },
      [Severity.MEDIUM]: { days: 30, description: '中危漏洞：30天内必须修复' },
      [Severity.LOW]: { days: 90, description: '低危漏洞：90天内修复' }
    };

    const window = repairWindows[severity];
    const dueDate = new Date(discoveredDate);
    dueDate.setDate(dueDate.getDate() + window.days);

    return {
      dueDate,
      recommendedDays: window.days,
      description: window.description
    };
  }

  static checkBatchConsistency(
    batchStatus: string,
    vulnerabilities: { status: VulnerabilityStatus }[]
  ): { consistent: boolean; issues: string[] } {
    const issues: string[] = [];

    if (batchStatus === 'DEPLOYED') {
      const uncompletedVulns = vulnerabilities.filter(
        v => ![VulnerabilityStatus.DEPLOYED, VulnerabilityStatus.CLOSED].includes(v.status)
      );
      if (uncompletedVulns.length > 0) {
        issues.push(`批次已标记为上线，但仍有 ${uncompletedVulns.length} 个漏洞未上线`);
      }
    }

    if (batchStatus === 'PLANNED') {
      const inProgressVulns = vulnerabilities.filter(
        v => v.status !== VulnerabilityStatus.NEW && v.status !== VulnerabilityStatus.ASSIGNED
      );
      if (inProgressVulns.length > 0) {
        issues.push(`批次仍在计划中，但已有 ${inProgressVulns.length} 个漏洞开始处理`);
      }
    }

    return {
      consistent: issues.length === 0,
      issues
    };
  }

  static validateRepeatAssignment(
    vulnerabilityId: string,
    assigneeId: string,
    existingAssignments: { vulnerabilityId: string; assigneeId: string; isActive: boolean }[]
  ): { isRepeat: boolean; lastAssignment?: typeof existingAssignments[0] } {
    const matchingAssignments = existingAssignments.filter(
      a => a.vulnerabilityId === vulnerabilityId && a.assigneeId === assigneeId
    );

    if (matchingAssignments.length === 0) {
      return { isRepeat: false };
    }

    const activeAssignment = matchingAssignments.find(a => a.isActive);
    const lastAssignment = matchingAssignments.sort((a, b) => {
      return (b as any).createdAt?.getTime() - (a as any).createdAt?.getTime();
    })[0];

    return {
      isRepeat: true,
      lastAssignment: activeAssignment || lastAssignment
    };
  }
}
