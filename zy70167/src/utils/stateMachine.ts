import { RuleVersionStatus, StateTransitionError } from '../types';

const RULE_VERSION_TRANSITIONS: Record<RuleVersionStatus, RuleVersionStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'ARCHIVED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'DRAFT'],
  REJECTED: ['DRAFT'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionRuleVersion(
  fromStatus: RuleVersionStatus,
  toStatus: RuleVersionStatus
): boolean {
  const allowedTransitions = RULE_VERSION_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

export function getValidTransitions(
  status: RuleVersionStatus
): RuleVersionStatus[] {
  return RULE_VERSION_TRANSITIONS[status] || [];
}

export function validateRuleVersionTransition(
  fromStatus: RuleVersionStatus,
  toStatus: RuleVersionStatus
): StateTransitionError | null {
  if (fromStatus === toStatus) {
    return {
      code: 'SAME_STATUS',
      message: `状态已经是 "${toStatus}"，无需重复操作`,
      fromStatus,
      toStatus,
    };
  }

  if (!canTransitionRuleVersion(fromStatus, toStatus)) {
    const validTransitions = getValidTransitions(fromStatus);
    return {
      code: 'INVALID_TRANSITION',
      message: `无法从 "${fromStatus}" 转换到 "${toStatus}"。允许的转换: ${validTransitions.length > 0 ? validTransitions.join('、') : '无'}`,
      fromStatus,
      toStatus,
      allowedTransitions: validTransitions,
    };
  }

  return null;
}

export function getStatusDescription(status: RuleVersionStatus): string {
  const descriptions: Record<RuleVersionStatus, string> = {
    DRAFT: '草稿 - 规则正在编辑中，未提交审批',
    PENDING_APPROVAL: '待审批 - 规则已提交，等待审批通过',
    APPROVED: '已通过 - 审批通过，可以发布',
    REJECTED: '已拒绝 - 审批被拒绝，请修改后重新提交',
    PUBLISHED: '已发布 - 规则已正式发布，开始生效',
    ARCHIVED: '已归档 - 规则已停用归档',
  };
  return descriptions[status] || status;
}

export function getBatchStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    PENDING: '待执行 - 批次重算任务已创建，等待执行',
    RUNNING: '执行中 - 批次重算任务正在执行',
    SUCCESS: '成功 - 批次重算任务执行成功',
    FAILED: '失败 - 批次重算任务执行失败',
  };
  return descriptions[status] || status;
}
