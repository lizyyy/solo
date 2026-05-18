import { DepositDeductionStatus, StateTransition } from '../types';
import { STATE_TRANSITIONS, ROLES } from '../config/constants';

export class StateTransitionError extends Error {
  constructor(message: string, public errorCode: string) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

export class StateMachineService {
  private transitions: StateTransition[] = STATE_TRANSITIONS;

  canTransition(
    fromStatus: DepositDeductionStatus,
    toStatus: DepositDeductionStatus,
    role: string
  ): { allowed: boolean; transition?: StateTransition; reason?: string } {
    const transition = this.transitions.find(
      t => t.from === fromStatus && t.to === toStatus
    );

    if (!transition) {
      return {
        allowed: false,
        reason: `不允许从 ${fromStatus} 状态变更到 ${toStatus} 状态`
      };
    }

    if (!transition.allowedRoles.includes(role)) {
      return {
        allowed: false,
        reason: `角色 ${role} 没有权限执行此操作，允许的角色: ${transition.allowedRoles.join(', ')}`
      };
    }

    return {
      allowed: true,
      transition
    };
  }

  canPerformAction(
    currentStatus: DepositDeductionStatus,
    action: string,
    role: string
  ): { allowed: boolean; transition?: StateTransition; reason?: string } {
    const transition = this.transitions.find(
      t => t.from === currentStatus && t.action === action
    );

    if (!transition) {
      return {
        allowed: false,
        reason: `在 ${currentStatus} 状态下不允许执行 ${action} 操作`
      };
    }

    if (!transition.allowedRoles.includes(role)) {
      return {
        allowed: false,
        reason: `角色 ${role} 没有权限执行 ${action} 操作，允许的角色: ${transition.allowedRoles.join(', ')}`
      };
    }

    return {
      allowed: true,
      transition
    };
  }

  getAvailableActions(status: DepositDeductionStatus, role: string): StateTransition[] {
    return this.transitions.filter(
      t => t.from === status && t.allowedRoles.includes(role)
    );
  }

  getAllTransitions(): StateTransition[] {
    return this.transitions;
  }

  getStatusDescription(status: DepositDeductionStatus): string {
    const descriptions: Record<DepositDeductionStatus, string> = {
      [DepositDeductionStatus.DRAFT]: '草稿',
      [DepositDeductionStatus.SUBMITTED]: '已提交待审核',
      [DepositDeductionStatus.REVIEWING]: '审核中',
      [DepositDeductionStatus.APPROVED]: '审核通过',
      [DepositDeductionStatus.REJECTED]: '审核驳回',
      [DepositDeductionStatus.EXECUTED]: '已执行扣款',
      [DepositDeductionStatus.CANCELLED]: '已取消'
    };
    return descriptions[status];
  }

  validateTransition(
    fromStatus: DepositDeductionStatus,
    action: string,
    role: string
  ): StateTransition {
    const result = this.canPerformAction(fromStatus, action, role);
    
    if (!result.allowed || !result.transition) {
      throw new StateTransitionError(
        result.reason || '状态转换验证失败',
        'STATE_TRANSITION_NOT_ALLOWED'
      );
    }

    return result.transition;
  }
}

export const stateMachine = new StateMachineService();