import {
  BusinessStatus,
  AuditAction,
  BusinessObject,
  AuditTrail,
} from '@/types';

export interface StateTransition {
  from: BusinessStatus;
  event: AuditAction;
  to: BusinessStatus;
  allowedRoles: ('teller' | 'supervisor' | 'auditor')[];
  requiresRemark: boolean;
}

export const STATE_TRANSITIONS: StateTransition[] = [
  {
    from: 'pending',
    event: 'submit',
    to: 'processing',
    allowedRoles: ['teller', 'supervisor'],
    requiresRemark: false,
  },
  {
    from: 'processing',
    event: 'detect_issue',
    to: 'issue_found',
    allowedRoles: ['teller', 'supervisor', 'auditor'],
    requiresRemark: true,
  },
  {
    from: 'processing',
    event: 'detect_issue',
    to: 'duplicate_check',
    allowedRoles: ['teller', 'supervisor', 'auditor'],
    requiresRemark: true,
  },
  {
    from: 'processing',
    event: 'recheck',
    to: 'pending_review',
    allowedRoles: ['teller', 'supervisor'],
    requiresRemark: false,
  },
  {
    from: 'issue_found',
    event: 'request_supplement',
    to: 'supplementing',
    allowedRoles: ['supervisor'],
    requiresRemark: true,
  },
  {
    from: 'issue_found',
    event: 'recheck',
    to: 'pending_review',
    allowedRoles: ['teller', 'supervisor'],
    requiresRemark: false,
  },
  {
    from: 'supplementing',
    event: 'upload_supplement',
    to: 'processing',
    allowedRoles: ['teller', 'supervisor'],
    requiresRemark: true,
  },
  {
    from: 'supplementing',
    event: 'recheck',
    to: 'pending_review',
    allowedRoles: ['teller', 'supervisor'],
    requiresRemark: false,
  },
  {
    from: 'duplicate_check',
    event: 'review_pass',
    to: 'pending_review',
    allowedRoles: ['supervisor'],
    requiresRemark: true,
  },
  {
    from: 'duplicate_check',
    event: 'review_reject',
    to: 'rejected',
    allowedRoles: ['supervisor'],
    requiresRemark: true,
  },
  {
    from: 'duplicate_check',
    event: 'recheck',
    to: 'pending_review',
    allowedRoles: ['teller', 'supervisor'],
    requiresRemark: false,
  },
  {
    from: 'pending_review',
    event: 'review_pass',
    to: 'confirmed',
    allowedRoles: ['supervisor'],
    requiresRemark: true,
  },
  {
    from: 'pending_review',
    event: 'review_reject',
    to: 'issue_found',
    allowedRoles: ['supervisor'],
    requiresRemark: true,
  },
  {
    from: 'confirmed',
    event: 'withdraw',
    to: 'withdrawn',
    allowedRoles: ['supervisor'],
    requiresRemark: true,
  },
  {
    from: 'withdrawn',
    event: 'resubmit',
    to: 'pending',
    allowedRoles: ['teller', 'supervisor'],
    requiresRemark: true,
  },
  {
    from: 'confirmed',
    event: 'export',
    to: 'confirmed',
    allowedRoles: ['teller', 'supervisor', 'auditor'],
    requiresRemark: false,
  },
];

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  toState?: BusinessStatus;
}

export const canTransition = (
  fromState: BusinessStatus,
  event: AuditAction,
  userRole: string
): TransitionResult => {
  const transition = STATE_TRANSITIONS.find(
    (t) => t.from === fromState && t.event === event
  );

  if (!transition) {
    return {
      allowed: false,
      reason: `当前状态【${fromState}】不允许执行【${event}】操作`,
    };
  }

  if (!transition.allowedRoles.includes(userRole as any)) {
    return {
      allowed: false,
      reason: `您的角色【${userRole}】无权限执行此操作`,
    };
  }

  return {
    allowed: true,
    toState: transition.to,
  };
};

export const createAuditTrail = (
  business: BusinessObject,
  action: AuditAction,
  operator: string,
  remark: string,
  toStatus: BusinessStatus
): AuditTrail => {
  return {
    id: `trail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    businessNo: business.businessNo,
    action,
    operator,
    operateTime: new Date().toISOString(),
    remark,
    fromStatus: business.status,
    toStatus,
  };
};

export const getAvailableActions = (
  status: BusinessStatus,
  userRole: string
): AuditAction[] => {
  return STATE_TRANSITIONS.filter(
    (t) =>
      t.from === status &&
      t.allowedRoles.includes(userRole as any) &&
      t.event !== 'detect_issue'
  ).map((t) => t.event);
};

export const getStatusDescription = (status: BusinessStatus): string => {
  const descriptions: Record<BusinessStatus, string> = {
    pending: '业务已创建，等待柜员提交审核',
    processing: '柜员已提交，系统正在进行自动校验',
    issue_found: '校验发现问题，需要人工处理',
    supplementing: '已通知客户补件，等待材料补充',
    pending_review: '校验通过，等待主管复核',
    duplicate_check: '检测到疑似重复汇款，需要人工核实',
    confirmed: '主管复核通过，业务已确认',
    withdrawn: '已确认的业务被撤回，需要重新处理',
    rejected: '业务被拒绝，无法继续处理',
    closed: '业务已关闭归档',
  };
  return descriptions[status];
};
