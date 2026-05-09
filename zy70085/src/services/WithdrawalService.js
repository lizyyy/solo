const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  OccupationApplication, WithdrawalApplication,
  RoadSection, FineRecord, sequelize
} = require('../models');
const {
  ApplicationStatus, WithdrawalStatus, FineStatus, RoadSectionStatus
} = require('../constants/status');
const { StatusManager, StatusValidationError } = require('./StatusManager');

function generateWithdrawalNo() {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WTH-${year}-${random}`;
}

class WithdrawalService {
  static async createWithdrawal(applicationId, data, operator = 'system') {
    const { reason, requestedDate } = data;

    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('占道申请不存在');
    }

    const validStatuses = [
      ApplicationStatus.IN_PROGRESS,
      ApplicationStatus.EXTENSION_REJECTED
    ];

    if (!validStatuses.includes(application.status)) {
      throw new StatusValidationError('只有进行中或延期被拒的申请才能申请撤场');
    }

    const existingActive = await WithdrawalApplication.findOne({
      where: {
        occupationApplicationId: applicationId,
        isActive: true,
        status: {
          [Op.notIn]: [WithdrawalStatus.PASSED]
        }
      }
    });

    if (existingActive) {
      throw new StatusValidationError('存在未完成的撤场申请');
    }

    const existingWithdrawals = await WithdrawalApplication.findAll({
      where: {
        occupationApplicationId: applicationId
      }
    });

    const reapplicationCount = existingWithdrawals.length;

    const t = await sequelize.transaction();

    try {
      const withdrawal = await WithdrawalApplication.create({
        applicationNo: generateWithdrawalNo(),
        occupationApplicationId: applicationId,
        requestedDate: requestedDate ? new Date(requestedDate) : new Date(),
        reason,
        status: WithdrawalStatus.PENDING,
        submittedAt: new Date(),
        reapplicationCount,
        isActive: true,
        version: 1,
        metadata: {
          createdBy: operator
        }
      }, { transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.WITHDRAWAL_PENDING,
        operator,
        `提交撤场申请: ${withdrawal.applicationNo}`
      );

      application.hasPendingWithdrawal = true;
      await application.save({ transaction: t });

      await t.commit();

      return withdrawal;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async startInspection(withdrawalId, operator = 'system') {
    const withdrawal = await WithdrawalApplication.findByPk(withdrawalId);
    if (!withdrawal) {
      throw new Error('撤场申请不存在');
    }

    const validStatuses = [
      WithdrawalStatus.PENDING,
      WithdrawalStatus.REINSPECTION_PENDING
    ];

    if (!validStatuses.includes(withdrawal.status)) {
      throw new StatusValidationError('当前状态无法开始验收');
    }

    withdrawal.status = WithdrawalStatus.INSPECTING;
    withdrawal.inspectionDate = new Date();
    withdrawal.version = withdrawal.version + 1;

    await withdrawal.save();

    return withdrawal;
  }

  static async passInspection(withdrawalId, inspectionData, operator = 'system') {
    const withdrawal = await WithdrawalApplication.findByPk(withdrawalId);
    if (!withdrawal) {
      throw new Error('撤场申请不存在');
    }

    const validStatuses = [
      WithdrawalStatus.PENDING,
      WithdrawalStatus.INSPECTING,
      WithdrawalStatus.FAILED,
      WithdrawalStatus.REINSPECTION_PENDING
    ];

    if (!validStatuses.includes(withdrawal.status)) {
      throw new StatusValidationError('当前状态无法通过验收');
    }

    const application = await OccupationApplication.findByPk(withdrawal.occupationApplicationId, {
      include: [{ model: RoadSection, as: 'roadSection' }]
    });

    const t = await sequelize.transaction();

    try {
      withdrawal.status = WithdrawalStatus.PASSED;
      withdrawal.inspectionDate = new Date();
      withdrawal.inspectionResult = inspectionData.result || '验收通过';
      withdrawal.inspectionScore = inspectionData.score || 100;
      withdrawal.passedAt = new Date();
      withdrawal.isActive = false;
      withdrawal.version = withdrawal.version + 1;
      await withdrawal.save({ transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.COMPLETED,
        operator,
        `撤场验收通过: ${withdrawal.applicationNo}`
      );

      application.hasPendingWithdrawal = false;
      application.completedAt = new Date();
      await application.save({ transaction: t });

      const roadSection = application.roadSection;
      const newAvailableLength = roadSection.availableLength + application.occupiedLength;
      let newStatus = RoadSectionStatus.AVAILABLE;

      if (newAvailableLength < roadSection.totalLength) {
        newStatus = RoadSectionStatus.PARTIALLY_OCCUPIED;
      }

      await roadSection.update({
        availableLength: newAvailableLength,
        status: newStatus
      }, { transaction: t });

      await t.commit();

      return { withdrawal, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async failInspection(withdrawalId, inspectionData, operator = 'system') {
    const withdrawal = await WithdrawalApplication.findByPk(withdrawalId);
    if (!withdrawal) {
      throw new Error('撤场申请不存在');
    }

    const validStatuses = [
      WithdrawalStatus.PENDING,
      WithdrawalStatus.INSPECTING
    ];

    if (!validStatuses.includes(withdrawal.status)) {
      throw new StatusValidationError('当前状态无法驳回验收');
    }

    const application = await OccupationApplication.findByPk(withdrawal.occupationApplicationId);

    const t = await sequelize.transaction();

    try {
      withdrawal.status = WithdrawalStatus.FAILED;
      withdrawal.inspectionDate = new Date();
      withdrawal.inspectionResult = inspectionData.result || '验收未通过';
      withdrawal.inspectionScore = inspectionData.score || 0;
      withdrawal.requiredRepairs = inspectionData.requiredRepairs || [];
      withdrawal.failedAt = new Date();
      withdrawal.failureReason = inspectionData.failureReason || '需要整改';
      withdrawal.version = withdrawal.version + 1;
      await withdrawal.save({ transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.IN_PROGRESS,
        operator,
        `撤场验收未通过，退回整改: ${inspectionData.failureReason || ''}`
      );

      application.hasPendingWithdrawal = false;
      await application.save({ transaction: t });

      await t.commit();

      return { withdrawal, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async requestReinspection(withdrawalId, operator = 'system') {
    const withdrawal = await WithdrawalApplication.findByPk(withdrawalId);
    if (!withdrawal) {
      throw new Error('撤场申请不存在');
    }

    if (withdrawal.status !== WithdrawalStatus.FAILED) {
      throw new StatusValidationError('只有验收失败的申请才能申请复检');
    }

    withdrawal.status = WithdrawalStatus.REINSPECTION_PENDING;
    withdrawal.version = withdrawal.version + 1;

    const application = await OccupationApplication.findByPk(withdrawal.occupationApplicationId);

    const t = await sequelize.transaction();

    try {
      await withdrawal.save({ transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.WITHDRAWAL_PENDING,
        operator,
        '申请撤场复检'
      );

      application.hasPendingWithdrawal = true;
      await application.save({ transaction: t });

      await t.commit();

      return { withdrawal, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async getWithdrawal(withdrawalId) {
    return await WithdrawalApplication.findByPk(withdrawalId, {
      include: [
        { model: OccupationApplication, as: 'occupationApplication' }
      ]
    });
  }

  static async listWithdrawals(applicationId) {
    return await WithdrawalApplication.findAll({
      where: {
        occupationApplicationId: applicationId
      },
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = {
  WithdrawalService,
  generateWithdrawalNo
};
