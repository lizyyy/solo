const { StatusAuditLog } = require('../models');
const { ApplicationStatus, ExtensionStatus, WithdrawalStatus, FineStatus } = require('../constants/status');

class StatusValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StatusValidationError';
    this.details = details;
  }
}

const applicationTransitions = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED],
  [ApplicationStatus.SUBMITTED]: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED],
  [ApplicationStatus.APPROVED]: [ApplicationStatus.IN_PROGRESS, ApplicationStatus.CANCELLED],
  [ApplicationStatus.IN_PROGRESS]: [
    ApplicationStatus.EXTENSION_PENDING,
    ApplicationStatus.WITHDRAWAL_PENDING,
    ApplicationStatus.CANCELLED
  ],
  [ApplicationStatus.EXTENSION_PENDING]: [
    ApplicationStatus.EXTENSION_APPROVED,
    ApplicationStatus.EXTENSION_REJECTED
  ],
  [ApplicationStatus.EXTENSION_APPROVED]: [ApplicationStatus.IN_PROGRESS],
  [ApplicationStatus.EXTENSION_REJECTED]: [
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.WITHDRAWAL_PENDING
  ],
  [ApplicationStatus.WITHDRAWAL_PENDING]: [
    ApplicationStatus.COMPLETED,
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.CANCELLED
  ],
  [ApplicationStatus.COMPLETED]: [ApplicationStatus.CLOSED],
  [ApplicationStatus.CLOSED]: [],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.CANCELLED]: []
};

const extensionTransitions = {
  [ExtensionStatus.PENDING]: [
    ExtensionStatus.APPROVED, ExtensionStatus.REJECTED, ExtensionStatus.CANCELLED
  ],
  [ExtensionStatus.APPROVED]: [],
  [ExtensionStatus.REJECTED]: [],
  [ExtensionStatus.CANCELLED]: []
};

const withdrawalTransitions = {
  [WithdrawalStatus.PENDING]: [
    WithdrawalStatus.INSPECTING,
    WithdrawalStatus.PASSED,
    WithdrawalStatus.FAILED
  ],
  [WithdrawalStatus.INSPECTING]: [
    WithdrawalStatus.PASSED,
    WithdrawalStatus.FAILED,
    WithdrawalStatus.REINSPECTION_PENDING
  ],
  [WithdrawalStatus.REINSPECTION_PENDING]: [
    WithdrawalStatus.INSPECTING,
    WithdrawalStatus.PASSED
  ],
  [WithdrawalStatus.FAILED]: [
    WithdrawalStatus.REINSPECTION_PENDING,
    WithdrawalStatus.PASSED
  ],
  [WithdrawalStatus.PASSED]: []
};

const fineTransitions = {
  [FineStatus.PENDING]: [
    FineStatus.ISSUED,
    FineStatus.WAIVED
  ],
  [FineStatus.ISSUED]: [
    FineStatus.PAID,
    FineStatus.DISPUTED,
    FineStatus.WAIVED
  ],
  [FineStatus.DISPUTED]: [
    FineStatus.PAID,
    FineStatus.WAIVED
  ],
  [FineStatus.PAID]: [],
  [FineStatus.WAIVED]: []
};

function validateTransition(transitions, fromStatus, toStatus) {
  const allowed = transitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

class StatusManager {
  static async validateApplicationTransition(fromStatus, toStatus) {
    return validateTransition(applicationTransitions, fromStatus, toStatus);
  }

  static async validateExtensionTransition(fromStatus, toStatus) {
    return validateTransition(extensionTransitions, fromStatus, toStatus);
  }

  static async validateWithdrawalTransition(fromStatus, toStatus) {
    return validateTransition(withdrawalTransitions, fromStatus, toStatus);
  }

  static async validateFineTransition(fromStatus, toStatus) {
    return validateTransition(fineTransitions, fromStatus, toStatus);
  }

  static async validateApplicationState(application, toStatus, context = {}) {
    const isValid = await this.validateApplicationTransition(application.status, toStatus);
    if (!isValid) {
      throw new StatusValidationError(
        `非法状态转换: ${application.status} -> ${toStatus}`,
        {
          applicationId: application.id,
          fromStatus: application.status,
          toStatus,
          applicationNo: application.applicationNo
        }
      );
    }

    if (toStatus === ApplicationStatus.EXTENSION_PENDING) {
      if (application.status !== ApplicationStatus.IN_PROGRESS) {
        throw new StatusValidationError(
          '只有进行中的申请才能申请延期',
          {
            currentStatus: application.status
          }
        );
      }
    }

    if (toStatus === ApplicationStatus.WITHDRAWAL_PENDING) {
      const validStatuses = [
        ApplicationStatus.IN_PROGRESS,
        ApplicationStatus.EXTENSION_REJECTED
      ];
      if (!validStatuses.includes(application.status)) {
        throw new StatusValidationError(
          '只有进行中或延期被拒的申请才能申请撤场',
          {
            currentStatus: application.status
          }
        );
      }
    }

    return true;
  }

  static async logStatusChange(entity, entityType, toStatus, changedBy, reason, snapshotData = {}) {
    const fromStatus = entity.status;
    const previousVersion = entity.version;
    const newVersion = previousVersion + 1;

    const auditLog = await StatusAuditLog.create({
      entityType,
      entityId: entity.id,
      fromStatus,
      toStatus,
      changedBy,
      changeReason: reason,
      previousVersion,
      newVersion,
      snapshot: {
        ...snapshotData,
        entityData: entity.toJSON()
      }
    });

    entity.status = toStatus;
    entity.version = newVersion;

    return auditLog;
  }

  static getApplicationAllowedTransitions(status) {
    return applicationTransitions[status] || [];
  }

  static getExtensionAllowedTransitions(status) {
    return extensionTransitions[status] || [];
  }

  static getWithdrawalAllowedTransitions(status) {
    return withdrawalTransitions[status] || [];
  }

  static getFineAllowedTransitions(status) {
    return fineTransitions[status] || [];
  }

  static async getStatusHistory(entityType, entityId) {
    return await StatusAuditLog.findAll({
      where: {
        entityType,
        entityId
      },
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = {
  StatusManager,
  StatusValidationError,
  applicationTransitions,
  extensionTransitions,
  withdrawalTransitions,
  fineTransitions
};
