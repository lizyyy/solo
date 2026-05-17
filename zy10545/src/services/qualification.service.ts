import { store } from '../models/store';
import { RegistrationStatus, QualificationCondition, Registration } from '../models/types';

export class QualificationService {
  checkQualification(applicantData: Record<string, any>, conditions: QualificationCondition[]): boolean {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = applicantData[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'greaterThan':
          return Number(fieldValue) > Number(condition.value);
        case 'lessThan':
          return Number(fieldValue) < Number(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        default:
          return false;
      }
    });
  }

  processRegistration(
    trainingId: string,
    applicantId: string,
    applicantName: string,
    applicantEmail: string,
    applicantData: Record<string, any>,
    operator: string
  ): Registration {
    const training = store.getTraining(trainingId);
    if (!training) {
      throw new Error('培训不存在');
    }

    const existingRegistrations = store.getRegistrationsByApplicant(applicantId);
    const existing = existingRegistrations.find(r => r.trainingId === trainingId);
    if (existing) {
      throw new Error('已报名该培训，请勿重复提交');
    }

    const isQualified = this.checkQualification(applicantData, training.qualificationConditions);
    const qualifiedCount = store.getQualifiedCount(trainingId);
    const hasAvailableSlots = qualifiedCount < training.maxSlots;

    let status: RegistrationStatus;
    let waitlistOrder: number | undefined;
    let processingBasis: string;

    if (!isQualified) {
      status = RegistrationStatus.REJECTED;
      processingBasis = '资格校验不通过：不符合培训资格条件';
    } else if (hasAvailableSlots) {
      status = RegistrationStatus.QUALIFIED;
      processingBasis = `资格校验通过，名额充足（当前${qualifiedCount}/${training.maxSlots}）`;
    } else {
      status = RegistrationStatus.WAITLIST;
      waitlistOrder = store.getNextWaitlistOrder(trainingId);
      processingBasis = `资格校验通过，但名额已满（当前${qualifiedCount}/${training.maxSlots}），进入候补队列，序号${waitlistOrder}`;
    }

    const registration = store.createRegistration({
      trainingId,
      trainingCode: training.trainingCode,
      applicantId,
      applicantName,
      applicantEmail,
      applicantData,
      status,
      waitlistOrder
    });

    store.addAuditTrail({
      registrationId: registration.id,
      action: 'CREATE_REGISTRATION',
      newStatus: status,
      operator,
      comment: processingBasis,
      rawInput: { applicantData, qualificationConditions: training.qualificationConditions },
      processingBasis
    });

    return registration;
  }

  approveRegistration(registrationId: string, operator: string, comment?: string): Registration | undefined {
    const registration = store.getRegistration(registrationId);
    if (!registration) return undefined;

    if (registration.status === RegistrationStatus.QUALIFIED) {
      throw new Error('报名已通过审核，请勿重复操作');
    }

    if (registration.status !== RegistrationStatus.PENDING_REVIEW) {
      throw new Error('当前状态不允许审核通过');
    }

    const training = store.getTraining(registration.trainingId);
    if (!training) return undefined;

    const qualifiedCount = store.getQualifiedCount(registration.trainingId);
    const hasAvailableSlots = qualifiedCount < training.maxSlots;

    let status: RegistrationStatus;
    let waitlistOrder: number | undefined;
    let processingBasis: string;

    if (hasAvailableSlots) {
      status = RegistrationStatus.QUALIFIED;
      processingBasis = `人工审核通过，名额充足（当前${qualifiedCount}/${training.maxSlots}）`;
    } else {
      status = RegistrationStatus.WAITLIST;
      waitlistOrder = store.getNextWaitlistOrder(registration.trainingId);
      processingBasis = `人工审核通过，但名额已满，进入候补队列，序号${waitlistOrder}`;
    }

    const updated = store.updateRegistration(registrationId, {
      status,
      waitlistOrder,
      reviewedBy: operator,
      reviewedAt: new Date(),
      reviewComment: comment
    });

    if (updated) {
      store.addAuditTrail({
        registrationId,
        action: 'APPROVE',
        previousStatus: registration.status,
        newStatus: status,
        operator,
        comment: comment || processingBasis,
        rawInput: { comment },
        processingBasis
      });
    }

    return updated;
  }

  rejectRegistration(registrationId: string, operator: string, comment: string): Registration | undefined {
    const registration = store.getRegistration(registrationId);
    if (!registration) return undefined;

    if (registration.status === RegistrationStatus.REJECTED) {
      throw new Error('报名已被拒绝，请勿重复操作');
    }

    const previousStatus = registration.status;
    const updated = store.updateRegistration(registrationId, {
      status: RegistrationStatus.REJECTED,
      reviewedBy: operator,
      reviewedAt: new Date(),
      reviewComment: comment
    });

    if (updated) {
      store.addAuditTrail({
        registrationId,
        action: 'REJECT',
        previousStatus,
        newStatus: RegistrationStatus.REJECTED,
        operator,
        comment,
        rawInput: { comment },
        processingBasis: '人工审核拒绝'
      });
    }

    return updated;
  }

  cancelRegistration(registrationId: string, operator: string, comment?: string): Registration | undefined {
    const registration = store.getRegistration(registrationId);
    if (!registration) return undefined;

    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new Error('报名已取消，请勿重复操作');
    }

    const previousStatus = registration.status;
    const wasQualified = previousStatus === RegistrationStatus.QUALIFIED;

    const updated = store.updateRegistration(registrationId, {
      status: RegistrationStatus.CANCELLED,
      reviewedBy: operator,
      reviewedAt: new Date(),
      reviewComment: comment
    });

    if (updated) {
      store.addAuditTrail({
        registrationId,
        action: 'CANCEL',
        previousStatus,
        newStatus: RegistrationStatus.CANCELLED,
        operator,
        comment,
        rawInput: { comment },
        processingBasis: '报名取消'
      });

      if (wasQualified) {
        this.promoteNextWaitlist(registration.trainingId, operator);
      }
    }

    return updated;
  }

  promoteNextWaitlist(trainingId: string, operator: string): Registration | undefined {
    const training = store.getTraining(trainingId);
    if (!training) return undefined;

    const qualifiedCount = store.getQualifiedCount(trainingId);
    if (qualifiedCount >= training.maxSlots) {
      return undefined;
    }

    const waitlist = store.getWaitlistRegistrations(trainingId);
    if (waitlist.length === 0) {
      return undefined;
    }

    const nextInLine = waitlist[0];
    const previousStatus = nextInLine.status;

    const promoted = store.updateRegistration(nextInLine.id, {
      status: RegistrationStatus.QUALIFIED,
      waitlistOrder: undefined,
      reviewedBy: operator,
      reviewedAt: new Date(),
      reviewComment: '候补晋级'
    });

    if (promoted) {
      store.addAuditTrail({
        registrationId: nextInLine.id,
        action: 'PROMOTE_FROM_WAITLIST',
        previousStatus,
        newStatus: RegistrationStatus.QUALIFIED,
        operator,
        comment: '候补自动晋级',
        processingBasis: `名额出现空缺，候补第${nextInLine.waitlistOrder}名晋级`
      });

      const remainingWaitlist = store.getWaitlistRegistrations(trainingId);
      remainingWaitlist.forEach((r, index) => {
        store.updateRegistration(r.id, { waitlistOrder: index + 1 });
      });
    }

    return promoted;
  }

  manualCorrect(
    registrationId: string,
    updates: Partial<Registration>,
    operator: string,
    reason: string
  ): Registration | undefined {
    const registration = store.getRegistration(registrationId);
    if (!registration) return undefined;

    const previousStatus = registration.status;
    const updated = store.updateRegistration(registrationId, updates);

    if (updated) {
      store.addAuditTrail({
        registrationId,
        action: 'MANUAL_CORRECTION',
        previousStatus,
        newStatus: updates.status,
        operator,
        comment: reason,
        rawInput: { updates },
        processingBasis: `人工修正：${reason}`
      });
    }

    return updated;
  }
}

export const qualificationService = new QualificationService();
