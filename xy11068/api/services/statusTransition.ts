import { ReturnStatus, StatusTransition } from '../../shared/types';

export const statusTransitions: StatusTransition[] = [
  {
    from: ReturnStatus.DRAFT,
    to: ReturnStatus.PENDING,
    action: '提交审核',
    allowed: true,
    requiresReason: false
  },
  {
    from: ReturnStatus.PENDING,
    to: ReturnStatus.APPROVED,
    action: '审核通过',
    allowed: true,
    requiresReason: false
  },
  {
    from: ReturnStatus.PENDING,
    to: ReturnStatus.REJECTED,
    action: '审核驳回',
    allowed: true,
    requiresReason: true
  },
  {
    from: ReturnStatus.PENDING,
    to: ReturnStatus.OWNERSHIP_ISSUE,
    action: '标记归属问题',
    allowed: true,
    requiresReason: true
  },
  {
    from: ReturnStatus.REJECTED,
    to: ReturnStatus.PENDING,
    action: '重新提交',
    allowed: true,
    requiresReason: false
  },
  {
    from: ReturnStatus.APPROVED,
    to: ReturnStatus.STORED,
    action: '设备入库',
    allowed: true,
    requiresReason: false
  },
  {
    from: ReturnStatus.APPROVED,
    to: ReturnStatus.OWNERSHIP_ISSUE,
    action: '标记归属问题',
    allowed: true,
    requiresReason: true
  },
  {
    from: ReturnStatus.OWNERSHIP_ISSUE,
    to: ReturnStatus.PROCESSING,
    action: '开始处理',
    allowed: true,
    requiresReason: false
  },
  {
    from: ReturnStatus.PROCESSING,
    to: ReturnStatus.APPROVED,
    action: '问题解决，通过审核',
    allowed: true,
    requiresReason: false
  },
  {
    from: ReturnStatus.PROCESSING,
    to: ReturnStatus.ISSUE_RECORDED,
    action: '记录问题，特殊处理',
    allowed: true,
    requiresReason: true
  },
  {
    from: ReturnStatus.STORED,
    to: ReturnStatus.COMPLETED,
    action: '完成流程',
    allowed: true,
    requiresReason: false
  },
  {
    from: ReturnStatus.ISSUE_RECORDED,
    to: ReturnStatus.COMPLETED,
    action: '完成流程',
    allowed: true,
    requiresReason: false
  }
];

export const getAllowedTransitions = (currentStatus: ReturnStatus): StatusTransition[] => {
  return statusTransitions.filter(t => t.from === currentStatus && t.allowed);
};

export const isTransitionAllowed = (from: ReturnStatus, to: ReturnStatus): boolean => {
  return statusTransitions.some(t => t.from === from && t.to === to && t.allowed);
};

export const getTransitionAction = (from: ReturnStatus, to: ReturnStatus): string | null => {
  const transition = statusTransitions.find(t => t.from === from && t.to === to);
  return transition ? transition.action : null;
};
