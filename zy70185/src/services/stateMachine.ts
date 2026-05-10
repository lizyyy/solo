import { BudgetVersionStatus, DepartmentSubmissionStatus, LockWindowStatus } from '@prisma/client';
import { StateTransitionError, ValidationError } from '../utils/errors';

const BUDGET_VERSION_TRANSITIONS: Record<BudgetVersionStatus, BudgetVersionStatus[]> = {
  [BudgetVersionStatus.DRAFT]: [BudgetVersionStatus.SUBMITTED],
  [BudgetVersionStatus.SUBMITTED]: [BudgetVersionStatus.UNDER_REVIEW, BudgetVersionStatus.REJECTED],
  [BudgetVersionStatus.UNDER_REVIEW]: [BudgetVersionStatus.APPROVED, BudgetVersionStatus.REJECTED],
  [BudgetVersionStatus.APPROVED]: [BudgetVersionStatus.LOCKED, BudgetVersionStatus.ROLLBACK_REQUESTED],
  [BudgetVersionStatus.LOCKED]: [BudgetVersionStatus.ROLLBACK_REQUESTED],
  [BudgetVersionStatus.REJECTED]: [BudgetVersionStatus.SUBMITTED],
  [BudgetVersionStatus.ROLLBACK_REQUESTED]: [BudgetVersionStatus.ROLLBACK_APPROVED, BudgetVersionStatus.ROLLBACK_REJECTED],
  [BudgetVersionStatus.ROLLBACK_APPROVED]: [BudgetVersionStatus.SUBMITTED],
  [BudgetVersionStatus.ROLLBACK_REJECTED]: [BudgetVersionStatus.LOCKED],
};

const DEPARTMENT_SUBMISSION_TRANSITIONS: Record<DepartmentSubmissionStatus, DepartmentSubmissionStatus[]> = {
  [DepartmentSubmissionStatus.PENDING]: [DepartmentSubmissionStatus.SUBMITTED],
  [DepartmentSubmissionStatus.SUBMITTED]: [DepartmentSubmissionStatus.UNDER_REVIEW, DepartmentSubmissionStatus.REJECTED],
  [DepartmentSubmissionStatus.UNDER_REVIEW]: [DepartmentSubmissionStatus.APPROVED, DepartmentSubmissionStatus.REJECTED],
  [DepartmentSubmissionStatus.APPROVED]: [DepartmentSubmissionStatus.LOCKED],
  [DepartmentSubmissionStatus.REJECTED]: [DepartmentSubmissionStatus.RESUBMITTED],
  [DepartmentSubmissionStatus.RESUBMITTED]: [DepartmentSubmissionStatus.SUBMITTED],
  [DepartmentSubmissionStatus.LOCKED]: [],
};

const LOCK_WINDOW_TRANSITIONS: Record<LockWindowStatus, LockWindowStatus[]> = {
  [LockWindowStatus.OPEN]: [LockWindowStatus.CLOSED],
  [LockWindowStatus.CLOSED]: [LockWindowStatus.LOCKED, LockWindowStatus.OPEN],
  [LockWindowStatus.LOCKED]: [],
};

const BUDGET_VERSION_STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  [BudgetVersionStatus.DRAFT]: '草稿',
  [BudgetVersionStatus.SUBMITTED]: '已提交',
  [BudgetVersionStatus.UNDER_REVIEW]: '审核中',
  [BudgetVersionStatus.APPROVED]: '已通过',
  [BudgetVersionStatus.LOCKED]: '已锁定',
  [BudgetVersionStatus.REJECTED]: '已驳回',
  [BudgetVersionStatus.ROLLBACK_REQUESTED]: '已申请回退',
  [BudgetVersionStatus.ROLLBACK_APPROVED]: '回退已批准',
  [BudgetVersionStatus.ROLLBACK_REJECTED]: '回退已驳回',
};

const DEPARTMENT_SUBMISSION_STATUS_LABELS: Record<DepartmentSubmissionStatus, string> = {
  [DepartmentSubmissionStatus.PENDING]: '待提交',
  [DepartmentSubmissionStatus.SUBMITTED]: '已提交',
  [DepartmentSubmissionStatus.UNDER_REVIEW]: '审核中',
  [DepartmentSubmissionStatus.APPROVED]: '已通过',
  [DepartmentSubmissionStatus.REJECTED]: '已驳回',
  [DepartmentSubmissionStatus.RESUBMITTED]: '需重新提交',
  [DepartmentSubmissionStatus.LOCKED]: '已锁定',
};

const LOCK_WINDOW_STATUS_LABELS: Record<LockWindowStatus, string> = {
  [LockWindowStatus.OPEN]: '开放中',
  [LockWindowStatus.CLOSED]: '已关闭',
  [LockWindowStatus.LOCKED]: '已锁定',
};

export class StateMachineService {
  canTransitionBudgetVersion(
    currentStatus: BudgetVersionStatus,
    targetStatus: BudgetVersionStatus
  ): boolean {
    const allowedTransitions = BUDGET_VERSION_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(targetStatus);
  }

  canTransitionDepartmentSubmission(
    currentStatus: DepartmentSubmissionStatus,
    targetStatus: DepartmentSubmissionStatus
  ): boolean {
    const allowedTransitions = DEPARTMENT_SUBMISSION_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(targetStatus);
  }

  canTransitionLockWindow(
    currentStatus: LockWindowStatus,
    targetStatus: LockWindowStatus
  ): boolean {
    const allowedTransitions = LOCK_WINDOW_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(targetStatus);
  }

  validateBudgetVersionTransition(
    currentStatus: BudgetVersionStatus,
    targetStatus: BudgetVersionStatus,
    entityName: string = '预算版本'
  ): void {
    if (currentStatus === targetStatus) {
      throw new ValidationError(`${entityName}当前状态已为「${this.getBudgetVersionStatusLabel(currentStatus)}」，无需重复操作`);
    }

    if (!this.canTransitionBudgetVersion(currentStatus, targetStatus)) {
      const allowedTransitions = BUDGET_VERSION_TRANSITIONS[currentStatus] || [];
      const allowedLabels = allowedTransitions
        .map(s => `「${this.getBudgetVersionStatusLabel(s)}」`)
        .join(' 或 ');

      throw new StateTransitionError(
        `${entityName}无法从「${this.getBudgetVersionStatusLabel(currentStatus)}」变更为「${this.getBudgetVersionStatusLabel(targetStatus)}」。` +
        (allowedLabels ? `当前允许变更为：${allowedLabels}` : '当前状态不允许任何状态变更'),
        currentStatus,
        targetStatus
      );
    }
  }

  validateDepartmentSubmissionTransition(
    currentStatus: DepartmentSubmissionStatus,
    targetStatus: DepartmentSubmissionStatus,
    entityName: string = '部门提交'
  ): void {
    if (currentStatus === targetStatus) {
      throw new ValidationError(`${entityName}当前状态已为「${this.getDepartmentSubmissionStatusLabel(currentStatus)}」，无需重复操作`);
    }

    if (!this.canTransitionDepartmentSubmission(currentStatus, targetStatus)) {
      const allowedTransitions = DEPARTMENT_SUBMISSION_TRANSITIONS[currentStatus] || [];
      const allowedLabels = allowedTransitions
        .map(s => `「${this.getDepartmentSubmissionStatusLabel(s)}」`)
        .join(' 或 ');

      throw new StateTransitionError(
        `${entityName}无法从「${this.getDepartmentSubmissionStatusLabel(currentStatus)}」变更为「${this.getDepartmentSubmissionStatusLabel(targetStatus)}」。` +
        (allowedLabels ? `当前允许变更为：${allowedLabels}` : '当前状态不允许任何状态变更'),
        currentStatus,
        targetStatus
      );
    }
  }

  validateLockWindowTransition(
    currentStatus: LockWindowStatus,
    targetStatus: LockWindowStatus,
    entityName: string = '锁定窗口'
  ): void {
    if (currentStatus === targetStatus) {
      throw new ValidationError(`${entityName}当前状态已为「${this.getLockWindowStatusLabel(currentStatus)}」，无需重复操作`);
    }

    if (!this.canTransitionLockWindow(currentStatus, targetStatus)) {
      throw new StateTransitionError(
        `${entityName}无法从「${this.getLockWindowStatusLabel(currentStatus)}」变更为「${this.getLockWindowStatusLabel(targetStatus)}」。` +
        '锁定窗口一旦锁定，就不能再变更状态',
        currentStatus,
        targetStatus
      );
    }
  }

  getBudgetVersionStatusLabel(status: BudgetVersionStatus): string {
    return BUDGET_VERSION_STATUS_LABELS[status] || status;
  }

  getDepartmentSubmissionStatusLabel(status: DepartmentSubmissionStatus): string {
    return DEPARTMENT_SUBMISSION_STATUS_LABELS[status] || status;
  }

  getLockWindowStatusLabel(status: LockWindowStatus): string {
    return LOCK_WINDOW_STATUS_LABELS[status] || status;
  }

  getAllBudgetVersionTransitions(): Record<BudgetVersionStatus, BudgetVersionStatus[]> {
    return BUDGET_VERSION_TRANSITIONS;
  }

  getAllDepartmentSubmissionTransitions(): Record<DepartmentSubmissionStatus, DepartmentSubmissionStatus[]> {
    return DEPARTMENT_SUBMISSION_TRANSITIONS;
  }

  getAllLockWindowTransitions(): Record<LockWindowStatus, LockWindowStatus[]> {
    return LOCK_WINDOW_TRANSITIONS;
  }
}

export const stateMachineService = new StateMachineService();
