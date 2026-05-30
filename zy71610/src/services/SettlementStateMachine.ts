import dayjs from 'dayjs';
import {
  SettlementApplication,
  SettlementStatus,
  ReasonDetail,
} from '../types/models';

type StateTransition = {
  from: SettlementStatus[];
  to: SettlementStatus;
  allowedRoles: string[];
  reasonCode: string;
  reasonMessage: string;
};

const STATE_TRANSITIONS: StateTransition[] = [
  {
    from: ['DRAFT'],
    to: 'PENDING_REVIEW',
    allowedRoles: ['OPERATOR', 'SUPERVISOR'],
    reasonCode: 'SUBMIT_FOR_REVIEW',
    reasonMessage: '提交审核',
  },
  {
    from: ['PENDING_REVIEW'],
    to: 'REVIEWED',
    allowedRoles: ['SUPERVISOR', 'MANAGER'],
    reasonCode: 'REVIEW_PASS',
    reasonMessage: '审核通过',
  },
  {
    from: ['PENDING_REVIEW'],
    to: 'DRAFT',
    allowedRoles: ['SUPERVISOR', 'MANAGER'],
    reasonCode: 'REVIEW_RETURN',
    reasonMessage: '审核退回',
  },
  {
    from: ['REVIEWED'],
    to: 'APPROVED',
    allowedRoles: ['MANAGER'],
    reasonCode: 'APPROVE',
    reasonMessage: '审批通过',
  },
  {
    from: ['REVIEWED'],
    to: 'DRAFT',
    allowedRoles: ['MANAGER'],
    reasonCode: 'APPROVE_REJECT',
    reasonMessage: '审批拒绝',
  },
  {
    from: ['APPROVED'],
    to: 'EXECUTED',
    allowedRoles: ['OPERATOR', 'SUPERVISOR'],
    reasonCode: 'EXECUTE',
    reasonMessage: '执行结清',
  },
  {
    from: ['DRAFT', 'PENDING_REVIEW'],
    to: 'CANCELLED',
    allowedRoles: ['OPERATOR', 'SUPERVISOR', 'MANAGER'],
    reasonCode: 'CANCEL',
    reasonMessage: '取消申请',
  },
];

export class SettlementStateMachine {
  private createReason(
    code: string,
    message: string,
    source: string,
    operator?: string,
  ): ReasonDetail {
    return {
      code,
      message,
      source,
      timestamp: dayjs().toISOString(),
      operator,
    };
  }

  canTransition(
    currentStatus: SettlementStatus,
    targetStatus: SettlementStatus,
    userRole: string,
  ): boolean {
    const transition = STATE_TRANSITIONS.find(
      (t) => t.from.includes(currentStatus) && t.to === targetStatus,
    );
    if (!transition) return false;
    return transition.allowedRoles.includes(userRole);
  }

  getAvailableTransitions(
    currentStatus: SettlementStatus,
    userRole: string,
  ): SettlementStatus[] {
    return STATE_TRANSITIONS.filter(
      (t) => t.from.includes(currentStatus) && t.allowedRoles.includes(userRole),
    ).map((t) => t.to);
  }

  transition(
    application: SettlementApplication,
    targetStatus: SettlementStatus,
    userRole: string,
    operator: string,
    remark?: string,
  ): {
    success: boolean;
    updatedApplication: SettlementApplication;
    reason: ReasonDetail;
  } {
    const transition = STATE_TRANSITIONS.find(
      (t) =>
        t.from.includes(application.status) && t.to === targetStatus,
    );

    if (!transition) {
      return {
        success: false,
        updatedApplication: application,
        reason: this.createReason(
          'INVALID_TRANSITION',
          `不允许从${application.status}状态转换到${targetStatus}状态`,
          'SettlementStateMachine.transition',
          operator,
        ),
      };
    }

    if (!transition.allowedRoles.includes(userRole)) {
      return {
        success: false,
        updatedApplication: application,
        reason: this.createReason(
          'PERMISSION_DENIED',
          `角色${userRole}无权执行此状态转换`,
          'SettlementStateMachine.transition',
          operator,
        ),
      };
    }

    const reason = this.createReason(
      transition.reasonCode,
      `${transition.reasonMessage}${remark ? `：${remark}` : ''}`,
      'SettlementStateMachine.transition',
      operator,
    );

    const updatedApplication: SettlementApplication = {
      ...application,
      status: targetStatus,
      updatedAt: dayjs().toISOString(),
      updatedBy: operator,
      reasons: {
        ...application.reasons,
        stateTransition: [...application.reasons.stateTransition, reason],
      },
    };

    if (targetStatus === 'EXECUTED') {
      updatedApplication.settlementDate = dayjs().toISOString();
      updatedApplication.settledBy = operator;
    }

    return {
      success: true,
      updatedApplication,
      reason,
    };
  }

  isEditable(status: SettlementStatus): boolean {
    return ['DRAFT', 'PENDING_REVIEW'].includes(status);
  }

  isCorrectionAllowed(status: SettlementStatus): boolean {
    return ['DRAFT', 'PENDING_REVIEW', 'REVIEWED'].includes(status);
  }
}
