import { AuthorizationStatus, StatusChangeRecord } from '../models/types';

export interface StateTransition {
  from: AuthorizationStatus;
  to: AuthorizationStatus;
  action: string;
  allowedRoles: string[];
}

export const STATE_TRANSITIONS: StateTransition[] = [
  { from: AuthorizationStatus.DRAFT, to: AuthorizationStatus.PENDING_REVIEW, action: 'submit', allowedRoles: ['admin', 'teacher', 'parent'] },
  { from: AuthorizationStatus.PENDING_REVIEW, to: AuthorizationStatus.APPROVED, action: 'approve', allowedRoles: ['admin', 'principal'] },
  { from: AuthorizationStatus.PENDING_REVIEW, to: AuthorizationStatus.REJECTED, action: 'reject', allowedRoles: ['admin', 'principal'] },
  { from: AuthorizationStatus.APPROVED, to: AuthorizationStatus.REVOKED, action: 'revoke', allowedRoles: ['admin', 'principal'] },
  { from: AuthorizationStatus.APPROVED, to: AuthorizationStatus.SUSPENDED, action: 'suspend', allowedRoles: ['admin', 'principal'] },
  { from: AuthorizationStatus.SUSPENDED, to: AuthorizationStatus.APPROVED, action: 'resume', allowedRoles: ['admin', 'principal'] },
  { from: AuthorizationStatus.SUSPENDED, to: AuthorizationStatus.REVOKED, action: 'revoke', allowedRoles: ['admin', 'principal'] },
  { from: AuthorizationStatus.REJECTED, to: AuthorizationStatus.DRAFT, action: 'rework', allowedRoles: ['admin', 'teacher', 'parent'] },
  { from: AuthorizationStatus.DRAFT, to: AuthorizationStatus.DRAFT, action: 'update', allowedRoles: ['admin', 'teacher', 'parent'] },
];

export class StateMachine {
  canTransition(from: AuthorizationStatus, to: AuthorizationStatus, role: string): boolean {
    return STATE_TRANSITIONS.some(
      t => t.from === from && t.to === to && t.allowedRoles.includes(role)
    );
  }

  getAllowedTransitions(from: AuthorizationStatus, role: string): AuthorizationStatus[] {
    return STATE_TRANSITIONS
      .filter(t => t.from === from && t.allowedRoles.includes(role))
      .map(t => t.to);
  }

  getActionForTransition(from: AuthorizationStatus, to: AuthorizationStatus): string | undefined {
    const transition = STATE_TRANSITIONS.find(t => t.from === from && t.to === to);
    return transition?.action;
  }

  createStatusChangeRecord(
    fromStatus: AuthorizationStatus | undefined,
    toStatus: AuthorizationStatus,
    changedBy: string,
    reason: string
  ): StatusChangeRecord {
    return {
      fromStatus,
      toStatus,
      changedAt: new Date().toISOString(),
      changedBy,
      reason
    };
  }

  validateStatusTransition(
    currentStatus: AuthorizationStatus,
    newStatus: AuthorizationStatus,
    role: string
  ): { valid: boolean; message?: string } {
    if (currentStatus === newStatus) {
      return { valid: true, message: '状态未变化' };
    }

    const canTransition = this.canTransition(currentStatus, newStatus, role);
    
    if (!canTransition) {
      const allowedTransitions = this.getAllowedTransitions(currentStatus, role);
      return {
        valid: false,
        message: `不允许从 ${currentStatus} 转换到 ${newStatus}。允许的目标状态: ${allowedTransitions.join(', ') || '无'}`
      };
    }

    return { valid: true };
  }
}

export const stateMachine = new StateMachine();
