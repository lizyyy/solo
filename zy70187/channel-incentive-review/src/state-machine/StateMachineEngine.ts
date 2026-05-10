import { ChannelIncentiveStatus } from '../models/types';
import { StateTransitionRule, IStateMachineEngine, StateTransitionRequest, StateTransitionResult } from './types';

export class StateMachineEngine implements IStateMachineEngine {
  private readonly transitionRules: StateTransitionRule[];

  constructor() {
    this.transitionRules = this.initializeTransitionRules();
  }

  private initializeTransitionRules(): StateTransitionRule[] {
    return [
      {
        fromStatus: null,
        toStatus: ChannelIncentiveStatus.INITIAL,
        allowed: true,
        requiredConditions: ['operator.hasPermission:CREATE'],
        reasonTemplate: '创建新的渠道激励记录'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.INITIAL,
        toStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
        allowed: true,
        requiredConditions: ['achievementData.provided'],
        reasonTemplate: '提交达标数据进行审核'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
        toStatus: ChannelIncentiveStatus.VERIFIED,
        allowed: true,
        requiredConditions: ['verification.passed', 'no.pending.disputes'],
        reasonTemplate: '自动审核通过'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
        toStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        allowed: true,
        requiredConditions: ['verification.requires.review'],
        reasonTemplate: '需要人工复核'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.VERIFIED,
        toStatus: ChannelIncentiveStatus.DISPUTED,
        allowed: true,
        requiredConditions: ['dispute.raised'],
        reasonTemplate: '销售团队提出争议'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.VERIFIED,
        toStatus: ChannelIncentiveStatus.APPROVED,
        allowed: true,
        requiredConditions: ['approval.granted'],
        reasonTemplate: '审批通过'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.VERIFIED,
        toStatus: ChannelIncentiveStatus.REJECTED,
        allowed: true,
        requiredConditions: ['approval.denied'],
        reasonTemplate: '审批拒绝'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.DISPUTED,
        toStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        allowed: true,
        requiredConditions: ['dispute.assigned'],
        reasonTemplate: '争议进入人工复核'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.DISPUTED,
        toStatus: ChannelIncentiveStatus.VERIFIED,
        allowed: true,
        requiredConditions: ['dispute.dismissed'],
        reasonTemplate: '争议被驳回，恢复原状态'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        toStatus: ChannelIncentiveStatus.APPROVED,
        allowed: true,
        requiredConditions: ['manual.review.approved'],
        reasonTemplate: '人工复核通过'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        toStatus: ChannelIncentiveStatus.REJECTED,
        allowed: true,
        requiredConditions: ['manual.review.rejected'],
        reasonTemplate: '人工复核拒绝'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        toStatus: ChannelIncentiveStatus.VERIFIED,
        allowed: true,
        requiredConditions: ['dispute.dismissed'],
        reasonTemplate: '争议解决，恢复验证状态'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.APPROVED,
        toStatus: ChannelIncentiveStatus.PAYOUT_SCHEDULED,
        allowed: true,
        requiredConditions: ['payment.scheduled'],
        reasonTemplate: '安排付款'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.APPROVED,
        toStatus: ChannelIncentiveStatus.DISPUTED,
        allowed: true,
        requiredConditions: ['dispute.raised.before.payout'],
        reasonTemplate: '付款前提出争议'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.PAYOUT_SCHEDULED,
        toStatus: ChannelIncentiveStatus.PAID,
        allowed: true,
        requiredConditions: ['payment.completed'],
        reasonTemplate: '已付款'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.PAYOUT_SCHEDULED,
        toStatus: ChannelIncentiveStatus.CANCELLED,
        allowed: true,
        requiredConditions: ['payment.cancelled'],
        reasonTemplate: '取消付款'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.REJECTED,
        toStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        allowed: true,
        requiredConditions: ['reconsideration.requested'],
        reasonTemplate: '申请重新审核'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.REJECTED,
        toStatus: ChannelIncentiveStatus.CANCELLED,
        allowed: true,
        requiredConditions: ['no.further.action'],
        reasonTemplate: '取消记录'
      },
      
      {
        fromStatus: ChannelIncentiveStatus.PAID,
        toStatus: ChannelIncentiveStatus.DISPUTED,
        allowed: true,
        requiredConditions: ['post.payment.dispute.allowed'],
        reasonTemplate: '付款后争议（需要特殊权限）'
      }
    ];
  }

  public canTransition(request: StateTransitionRequest): StateTransitionResult {
    const rule = this.transitionRules.find(
      r => r.fromStatus === request.fromStatus && r.toStatus === request.toStatus
    );

    if (!rule) {
      const allowedTransitions = this.getAllowedTransitions(request.fromStatus as ChannelIncentiveStatus);
      return {
        success: false,
        errorCode: 'INVALID_TRANSITION',
        errorMessage: this.getInvalidTransitionMessage(request.fromStatus, request.toStatus, allowedTransitions),
        allowedTransitions
      };
    }

    if (!rule.allowed) {
      const allowedTransitions = this.getAllowedTransitions(request.fromStatus as ChannelIncentiveStatus);
      return {
        success: false,
        errorCode: 'TRANSITION_NOT_ALLOWED',
        errorMessage: `不允许从「${this.getStatusDescription(request.fromStatus)}」流转到「${this.getStatusDescription(request.toStatus)}」`,
        allowedTransitions
      };
    }

    return {
      success: true
    };
  }

  public transition(request: StateTransitionRequest): StateTransitionResult {
    const validation = this.canTransition(request);
    
    if (!validation.success) {
      return validation;
    }

    const statusChange: StatusChangeLog = {
      fromStatus: request.fromStatus,
      toStatus: request.toStatus,
      operator: request.operator,
      reason: request.reason,
      timestamp: request.operator.timestamp
    };

    return {
      success: true,
      statusChange
    };
  }

  public getAllowedTransitions(fromStatus: ChannelIncentiveStatus): ChannelIncentiveStatus[] {
    return this.transitionRules
      .filter(rule => rule.fromStatus === fromStatus && rule.allowed)
      .map(rule => rule.toStatus);
  }

  public getTransitionRules(): StateTransitionRule[] {
    return [...this.transitionRules];
  }

  private getInvalidTransitionMessage(
    fromStatus: ChannelIncentiveStatus | null,
    toStatus: ChannelIncentiveStatus,
    allowedTransitions: ChannelIncentiveStatus[]
  ): string {
    const fromDesc = this.getStatusDescription(fromStatus);
    const toDesc = this.getStatusDescription(toStatus);
    
    if (allowedTransitions.length === 0) {
      return `当前状态「${fromDesc}」不允许任何状态流转`;
    }
    
    const allowedDescriptions = allowedTransitions.map(t => `「${this.getStatusDescription(t)}」`).join('、');
    return `不能从「${fromDesc}」直接流转到「${toDesc}」。允许的流转状态：${allowedDescriptions}`;
  }

  private getStatusDescription(status: ChannelIncentiveStatus | null): string {
    const descriptions: Partial<Record<ChannelIncentiveStatus, string>> = {
      [ChannelIncentiveStatus.INITIAL]: '初始状态',
      [ChannelIncentiveStatus.PENDING_VERIFICATION]: '待审核',
      [ChannelIncentiveStatus.VERIFIED]: '已验证',
      [ChannelIncentiveStatus.DISPUTED]: '有争议',
      [ChannelIncentiveStatus.MANUAL_REVIEW]: '人工复核中',
      [ChannelIncentiveStatus.APPROVED]: '已审批',
      [ChannelIncentiveStatus.REJECTED]: '已拒绝',
      [ChannelIncentiveStatus.PAYOUT_SCHEDULED]: '付款待安排',
      [ChannelIncentiveStatus.PAID]: '已付款',
      [ChannelIncentiveStatus.CANCELLED]: '已取消'
    };
    
    return status ? (descriptions[status] || status) : '无状态';
  }
}

export const stateMachineEngine = new StateMachineEngine();
