import { RefundStatus, Role, LogAction } from '@prisma/client';
import { StatusTransitionError, ForbiddenError } from '../utils/errors';

interface TransitionConfig {
  from: RefundStatus[];
  to: RefundStatus;
  allowedRoles: Role[];
  action: LogAction;
  description: string;
}

export const stateTransitions: TransitionConfig[] = [
  {
    from: ['DRAFT'],
    to: 'PENDING_REVIEW',
    allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    action: 'STATUS_CHANGE',
    description: '提交审核'
  },
  {
    from: ['PENDING_REVIEW'],
    to: 'APPROVED',
    allowedRoles: ['ADMIN', 'MANAGER'],
    action: 'APPROVE',
    description: '审核通过'
  },
  {
    from: ['PENDING_REVIEW'],
    to: 'REJECTED',
    allowedRoles: ['ADMIN', 'MANAGER'],
    action: 'REJECT',
    description: '审核拒绝'
  },
  {
    from: ['PENDING_REVIEW'],
    to: 'DRAFT',
    allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    action: 'STATUS_CHANGE',
    description: '退回修改'
  },
  {
    from: ['APPROVED'],
    to: 'PROCESSING',
    allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    action: 'STATUS_CHANGE',
    description: '开始处理'
  },
  {
    from: ['PROCESSING'],
    to: 'SUCCESS',
    allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    action: 'STATUS_CHANGE',
    description: '退款成功'
  },
  {
    from: ['PROCESSING'],
    to: 'FAILED',
    allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    action: 'STATUS_CHANGE',
    description: '退款失败'
  },
  {
    from: ['FAILED'],
    to: 'PROCESSING',
    allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    action: 'RETRY',
    description: '重试退款'
  },
  {
    from: ['DRAFT', 'PENDING_REVIEW'],
    to: 'CANCELLED',
    allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    action: 'CANCEL',
    description: '取消退款'
  }
];

export class RefundStateMachine {
  private transitions: Map<string, TransitionConfig> = new Map();

  constructor() {
    stateTransitions.forEach(t => {
      t.from.forEach(from => {
        const key = `${from}:${t.to}`;
        this.transitions.set(key, t);
      });
    });
  }

  canTransition(from: RefundStatus, to: RefundStatus, userRole: Role): {
    allowed: boolean;
    transition?: TransitionConfig;
    reason?: string;
  } {
    if (from === to) {
      return { allowed: false, reason: '状态未发生变化' };
    }

    const key = `${from}:${to}`;
    const transition = this.transitions.get(key);

    if (!transition) {
      return { allowed: false, reason: `不允许从 ${from} 转换到 ${to}` };
    }

    if (!transition.allowedRoles.includes(userRole)) {
      return { allowed: false, reason: `角色 ${userRole} 无权执行此操作` };
    }

    return { allowed: true, transition };
  }

  validateTransition(
    from: RefundStatus,
    to: RefundStatus,
    userRole: Role
  ): TransitionConfig {
    const result = this.canTransition(from, to, userRole);

    if (!result.allowed) {
      if (result.reason?.includes('无权')) {
        throw new ForbiddenError(result.reason);
      }
      throw new StatusTransitionError(result.reason || '状态转换不允许');
    }

    return result.transition!;
  }

  getValidTransitions(status: RefundStatus, userRole: Role): TransitionConfig[] {
    return stateTransitions.filter(t =>
      t.from.includes(status) && t.allowedRoles.includes(userRole)
    );
  }

  isFinalStatus(status: RefundStatus): boolean {
    return ['SUCCESS', 'FAILED', 'CANCELLED', 'REJECTED'].includes(status);
  }

  canRetry(status: RefundStatus): boolean {
    return status === 'FAILED';
  }

  canEdit(status: RefundStatus): boolean {
    return ['DRAFT', 'PENDING_REVIEW'].includes(status);
  }
}

export const stateMachine = new RefundStateMachine();
