import { Prescription, PrescriptionStatus, WithdrawalRequest, AuditRequest } from './models';

export class StatusValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatusValidationError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class StateMachine {
  private static readonly validTransitions: Map<PrescriptionStatus, PrescriptionStatus[]> = new Map([
    [PrescriptionStatus.PRESCRIBED, [PrescriptionStatus.WITHDRAWING, PrescriptionStatus.DISPENSED]],
    [PrescriptionStatus.WITHDRAWING, [PrescriptionStatus.NOTIFIED, PrescriptionStatus.REJECTED]],
    [PrescriptionStatus.NOTIFIED, [PrescriptionStatus.CLOSED]],
    [PrescriptionStatus.REJECTED, [PrescriptionStatus.PRESCRIBED, PrescriptionStatus.CLOSED]],
    [PrescriptionStatus.DISPENSED, [PrescriptionStatus.CLOSED]],
    [PrescriptionStatus.CLOSED, []]
  ]);

  static canTransition(from: PrescriptionStatus, to: PrescriptionStatus): boolean {
    const allowed = this.validTransitions.get(from);
    return allowed ? allowed.includes(to) : false;
  }

  static validateTransition(prescription: Prescription, targetStatus: PrescriptionStatus): void {
    if (!this.canTransition(prescription.status, targetStatus)) {
      throw new StatusValidationError(
        `无法从状态 "${prescription.status}" 转换到 "${targetStatus}"`
      );
    }
  }
}

export class WithdrawalValidator {
  static validateWithdrawalRequest(prescription: Prescription, request: WithdrawalRequest): void {
    if (!request.reason || request.reason.trim().length === 0) {
      throw new StatusValidationError('撤回原因不能为空');
    }

    if (prescription.isDispensed) {
      throw new ConflictError(
        '处方已配药，无法直接撤回，请走特殊审批流程'
      );
    }

    StateMachine.validateTransition(prescription, PrescriptionStatus.WITHDRAWING);
  }

  static validateAudit(prescription: Prescription, request: AuditRequest): void {
    if (prescription.status !== PrescriptionStatus.WITHDRAWING) {
      throw new StatusValidationError('只有撤回中的处方才能进行审核');
    }

    if (request.approved) {
      StateMachine.validateTransition(prescription, PrescriptionStatus.NOTIFIED);
    } else {
      StateMachine.validateTransition(prescription, PrescriptionStatus.REJECTED);
    }
  }

  static validateClose(prescription: Prescription): void {
    const allowedStatuses = [
      PrescriptionStatus.NOTIFIED,
      PrescriptionStatus.REJECTED,
      PrescriptionStatus.DISPENSED
    ];

    if (!allowedStatuses.includes(prescription.status)) {
      throw new StatusValidationError(
        '只有已通知、已驳回或已配药状态的处方才能关闭'
      );
    }

    StateMachine.validateTransition(prescription, PrescriptionStatus.CLOSED);
  }

  static validateDispensed(prescription: Prescription): void {
    if (prescription.status !== PrescriptionStatus.PRESCRIBED) {
      throw new StatusValidationError('只有已开方状态的处方才能标记为已配药');
    }

    StateMachine.validateTransition(prescription, PrescriptionStatus.DISPENSED);
  }
}
