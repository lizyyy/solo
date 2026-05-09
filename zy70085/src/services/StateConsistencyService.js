const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { OccupationApplication, ExtensionApplication, WithdrawalApplication, FineRecord } = require('../models');
const {
  ApplicationStatus, ExtensionStatus, WithdrawalStatus, FineStatus } = require('../constants/status');
const { StatusManager, StatusValidationError } = require('./StatusManager');

class StateConsistencyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StateConsistencyError';
    this.details = details;
  }
}

class StateConsistencyService {
  static async validateOccupationState(application, operation) {
    const issues = [];
    const now = new Date();

    if (application.status === ApplicationStatus.IN_PROGRESS) {
      if (application.endDate < now && !application.hasActiveExtension) {
        issues.push('申请已过有效期但状态仍为进行中');
      }
    }

    if (application.hasActiveExtension) {
      const activeExtension = await ExtensionApplication.findOne({
        where: {
          occupationApplicationId: application.id,
          isActive: true,
          status: [ExtensionStatus.PENDING, ExtensionStatus.APPROVED]
        }
      });
      if (!activeExtension) {
        issues.push('标记为有活动延期但未找到对应记录');
      }
    }

    if (application.hasPendingWithdrawal) {
      const activeWithdrawal = await WithdrawalApplication.findOne({
        where: {
          occupationApplicationId: application.id,
          isActive: true,
          status: [
            WithdrawalStatus.PENDING,
            WithdrawalStatus.INSPECTING,
            WithdrawalStatus.REINSPECTION_PENDING,
            WithdrawalStatus.FAILED
          ]
        }
      });
      if (!activeWithdrawal) {
        issues.push('标记为有待处理撤场但未找到对应记录');
      }
    }

    return issues;
  }

  static async recalculateApplicationFlags(application) {
    const result = {
      hasActiveExtension: false,
      hasActiveFine: false,
      hasPendingWithdrawal: false,
      shouldBeStatus: application.status
    };

    const activeExtension = await ExtensionApplication.findOne({
      where: {
        occupationApplicationId: application.id,
        isActive: true,
        status: [ExtensionStatus.PENDING, ExtensionStatus.APPROVED]
      }
    });
    result.hasActiveExtension = !!activeExtension;

    const activeFine = await FineRecord.findOne({
      where: {
        occupationApplicationId: application.id,
        isActive: true,
        status: [FineStatus.PENDING, FineStatus.ISSUED, FineStatus.DISPUTED]
      }
    });
    result.hasActiveFine = !!activeFine;

    const pendingWithdrawal = await WithdrawalApplication.findOne({
      where: {
        occupationApplicationId: application.id,
        status: [
          WithdrawalStatus.PENDING,
          WithdrawalStatus.INSPECTING,
          WithdrawalStatus.REINSPECTION_PENDING,
          WithdrawalStatus.FAILED
        ]
      }
    });
    result.hasPendingWithdrawal = !!pendingWithdrawal;

    const now = new Date();

    if (application.status === ApplicationStatus.IN_PROGRESS) {
      if (application.endDate < now && !result.hasActiveExtension) {
        result.shouldBeStatus = ApplicationStatus.WITHDRAWAL_PENDING;
      }
    }

    return result;
  }

  static async repairApplicationState(application, operator = 'system') {
    const repairs = [];
    const originalStatus = application.status;
    const result = await this.recalculateApplicationFlags(application);

    if (application.hasActiveExtension !== result.hasActiveExtension) {
      application.hasActiveExtension = result.hasActiveExtension;
      repairs.push(`修复 hasActiveExtension: ${application.hasActiveExtension} -> ${result.hasActiveExtension}`);
    }

    if (application.hasActiveFine !== result.hasActiveFine) {
      application.hasActiveFine = result.hasActiveFine;
      repairs.push(`修复 hasActiveFine: ${application.hasActiveFine} -> ${result.hasActiveFine}`);
    }

    if (application.hasPendingWithdrawal !== result.hasPendingWithdrawal) {
      application.hasPendingWithdrawal = result.hasPendingWithdrawal;
      repairs.push(`修复 hasPendingWithdrawal: ${application.hasPendingWithdrawal} -> ${result.hasPendingWithdrawal}`);
    }

    if (result.shouldBeStatus !== originalStatus) {
      const canTransition = await StatusManager.validateApplicationTransition(originalStatus, result.shouldBeStatus);
      if (canTransition) {
        await StatusManager.logStatusChange(
          application,
          'OccupationApplication',
          result.shouldBeStatus,
          operator,
          '状态一致性修复',
          { repairReason: '自动修复状态不一致' }
        );
        repairs.push(`状态修正: ${originalStatus} -> ${result.shouldBeStatus}`);
      } else {
        repairs.push(`状态需要手动修复但无法自动转换: ${originalStatus} -> ${result.shouldBeStatus}`);
      }
    }

    if (repairs.length > 0) {
      await application.save();
    }

    return {
      applicationId: application.id,
      repairs,
      wasModified: repairs.length > 0
    };
  }

  static async repairAllInconsistentApplications(operator = 'system') {
    const applications = await OccupationApplication.findAll({
      where: {
        status: {
          [Op.notIn]: [ApplicationStatus.CLOSED, ApplicationStatus.CANCELLED, ApplicationStatus.REJECTED]
        }
      }
    });

    const results = [];

    for (const app of applications) {
      const result = await this.repairApplicationState(app, operator);
      if (result.wasModified) {
        results.push(result);
      }
    }

    return results;
  }

  static async verifyAndRepairApplication(applicationId, operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    return await this.repairApplicationState(application, operator);
  }
}

module.exports = {
  StateConsistencyService,
  StateConsistencyError
};
