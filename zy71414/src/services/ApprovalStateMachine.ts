import type { ApplicationStatus, StatusTransition } from '../types';

export class ApprovalStateMachine {
  private static transitions: Map<ApplicationStatus, ApplicationStatus[]> = new Map([
    ['DRAFT', ['SUBMITTED', 'CANCELLED']],
    ['SUBMITTED', ['APPROVING', 'WITHDRAWN', 'CANCELLED']],
    ['APPROVING', ['APPROVED', 'REJECTED', 'WITHDRAWN']],
    ['APPROVED', ['PAID', 'WITHDRAWN', 'CANCELLED']],
    ['REJECTED', ['DRAFT', 'CANCELLED']],
    ['WITHDRAWN', ['DRAFT', 'CANCELLED']],
    ['PAID', []],
    ['CANCELLED', []],
  ]);

  static canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    const allowed = this.transitions.get(from) || [];
    return allowed.includes(to);
  }

  static getAvailableTransitions(current: ApplicationStatus): ApplicationStatus[] {
    return this.transitions.get(current) || [];
  }

  static createTransition(
    applicationId: string,
    fromStatus: ApplicationStatus,
    toStatus: ApplicationStatus,
    operator: string,
    remark: string
  ): StatusTransition {
    return {
      id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      applicationId,
      fromStatus,
      toStatus,
      operator,
      operatorIp: '127.0.0.1',
      timestamp: new Date().toISOString(),
      remark,
    };
  }

  static isTerminalStatus(status: ApplicationStatus): boolean {
    const terminalStatuses: ApplicationStatus[] = ['PAID', 'CANCELLED'];
    return terminalStatuses.includes(status);
  }
}
