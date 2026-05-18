import { AppealStatus, StatusTransition } from '../types';

export const STATUS_TRANSITIONS: StatusTransition[] = [
  {
    from: AppealStatus.DRAFT,
    to: AppealStatus.SUBMITTED,
    allowedRoles: ['team_manager', 'team_captain'],
    action: 'submit',
    description: '提交申诉进入审核队列'
  },
  {
    from: AppealStatus.SUBMITTED,
    to: AppealStatus.UNDER_REVIEW,
    allowedRoles: ['league_reviewer', 'referee_chief'],
    action: 'start_review',
    description: '裁判长开始审核申诉'
  },
  {
    from: AppealStatus.SUBMITTED,
    to: AppealStatus.REJECTED,
    allowedRoles: ['league_reviewer', 'referee_chief'],
    action: 'quick_reject',
    description: '快速驳回不符合要求的申诉'
  },
  {
    from: AppealStatus.UNDER_REVIEW,
    to: AppealStatus.NEEDS_MORE_INFO,
    allowedRoles: ['league_reviewer', 'referee_chief'],
    action: 'request_info',
    description: '要求申诉方补充材料'
  },
  {
    from: AppealStatus.UNDER_REVIEW,
    to: AppealStatus.APPROVED,
    allowedRoles: ['league_reviewer', 'referee_chief'],
    action: 'approve',
    description: '审核通过，申诉成立'
  },
  {
    from: AppealStatus.UNDER_REVIEW,
    to: AppealStatus.REJECTED,
    allowedRoles: ['league_reviewer', 'referee_chief'],
    action: 'reject',
    description: '审核驳回，申诉不成立'
  },
  {
    from: AppealStatus.NEEDS_MORE_INFO,
    to: AppealStatus.UNDER_REVIEW,
    allowedRoles: ['team_manager', 'team_captain'],
    action: 'resubmit',
    description: '补充材料后重新提交审核'
  },
  {
    from: AppealStatus.NEEDS_MORE_INFO,
    to: AppealStatus.REJECTED,
    allowedRoles: ['league_reviewer', 'referee_chief'],
    action: 'timeout_reject',
    description: '超时未补充材料，自动驳回'
  },
  {
    from: AppealStatus.DRAFT,
    to: AppealStatus.DRAFT,
    allowedRoles: ['team_manager', 'team_captain'],
    action: 'update_draft',
    description: '更新草稿内容'
  }
];

export const TERMINAL_STATUSES = [AppealStatus.APPROVED, AppealStatus.REJECTED];

export function canTransition(
  currentStatus: AppealStatus,
  targetStatus: AppealStatus,
  userRole: string
): boolean {
  const transition = STATUS_TRANSITIONS.find(
    t => t.from === currentStatus && t.to === targetStatus
  );
  return transition ? transition.allowedRoles.includes(userRole) : false;
}

export function getAvailableTransitions(
  currentStatus: AppealStatus,
  userRole: string
): StatusTransition[] {
  return STATUS_TRANSITIONS.filter(
    t => t.from === currentStatus && t.allowedRoles.includes(userRole)
  );
}

export function isTerminalStatus(status: AppealStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function getStatusDisplayName(status: AppealStatus): string {
  const displayNames: Record<AppealStatus, string> = {
    [AppealStatus.DRAFT]: '草稿',
    [AppealStatus.SUBMITTED]: '待审核',
    [AppealStatus.UNDER_REVIEW]: '审核中',
    [AppealStatus.NEEDS_MORE_INFO]: '需补充',
    [AppealStatus.APPROVED]: '已通过',
    [AppealStatus.REJECTED]: '已驳回'
  };
  return displayNames[status];
}

export function validateStateTransition(
  currentStatus: AppealStatus,
  targetStatus: AppealStatus,
  userRole: string
): { valid: boolean; message: string; suggestions: string[] } {
  if (isTerminalStatus(currentStatus)) {
    return {
      valid: false,
      message: `当前状态"${getStatusDisplayName(currentStatus)}"为终态，不可再变更`,
      suggestions: ['该申诉流程已结束，如需继续请发起新的申诉', '查看申诉历史记录了解详情']
    };
  }

  const available = getAvailableTransitions(currentStatus, userRole);
  if (available.length === 0) {
    return {
      valid: false,
      message: `角色"${userRole}"在当前状态"${getStatusDisplayName(currentStatus)}"下无操作权限`,
      suggestions: ['请联系具有相应权限的人员进行操作', '确认您的登录账号是否正确']
    };
  }

  const canDo = canTransition(currentStatus, targetStatus, userRole);
  if (!canDo) {
    const allowedTargets = available.map(t => getStatusDisplayName(t.to));
    return {
      valid: false,
      message: `无法从"${getStatusDisplayName(currentStatus)}"变更为"${getStatusDisplayName(targetStatus)}"`,
      suggestions: [
        `当前角色可执行的操作: ${allowedTargets.join('、')}`,
        '请检查操作是否符合流程规范'
      ]
    };
  }

  return { valid: true, message: '状态变更合法', suggestions: [] };
}
