const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { OccupationApplication, ExtensionApplication, sequelize } = require('../models');
const { ApplicationStatus, ExtensionStatus } = require('../constants/status');
const { StatusManager, StatusValidationError } = require('./StatusManager');

function generateExtensionNo() {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EXT-${year}-${random}`;
}

class ExtensionService {
  static async createExtension(applicationId, data, operator = 'system') {
    const { requestedEndDate, reason } = data;

    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('占道申请不存在');
    }

    if (application.status !== ApplicationStatus.IN_PROGRESS) {
      throw new StatusValidationError('只有进行中的申请才能申请延期');
    }

    const existingPending = await ExtensionApplication.findOne({
      where: {
        occupationApplicationId: applicationId,
        status: ExtensionStatus.PENDING,
        isActive: true
      }
    });

    if (existingPending) {
      throw new StatusValidationError('存在待审批的延期申请，请勿重复申请');
    }

    const requestedEnd = new Date(requestedEndDate);
    const currentEnd = new Date(application.endDate);

    if (requestedEnd <= currentEnd) {
      throw new Error('延期结束日期必须晚于当前结束日期');
    }

    const extensionDays = Math.ceil((requestedEnd - currentEnd) / (1000 * 60 * 60 * 24));

    const existingExtensions = await ExtensionApplication.findAll({
      where: {
        occupationApplicationId: applicationId
      }
    });

    const sequence = existingExtensions.length + 1;

    const t = await sequelize.transaction();

    try {
      const extension = await ExtensionApplication.create({
        applicationNo: generateExtensionNo(),
        occupationApplicationId: applicationId,
        requestedEndDate: requestedEnd,
        previousEndDate: currentEnd,
        extensionDays,
        reason,
        status: ExtensionStatus.PENDING,
        submittedAt: new Date(),
        isActive: true,
        version: 1,
        sequence,
        metadata: {
          createdBy: operator
        }
      }, { transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.EXTENSION_PENDING,
        operator,
        `提交延期申请: ${extension.applicationNo}`
      );

      application.hasActiveExtension = true;
      await application.save({ transaction: t });

      await t.commit();

      return extension;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async approveExtension(extensionId, approvalComment = '', operator = 'system') {
    const extension = await ExtensionApplication.findByPk(extensionId);
    if (!extension) {
      throw new Error('延期申请不存在');
    }

    if (extension.status !== ExtensionStatus.PENDING) {
      throw new StatusValidationError('只有待审批的延期申请才能通过');
    }

    const application = await OccupationApplication.findByPk(extension.occupationApplicationId);

    const t = await sequelize.transaction();

    try {
      extension.status = ExtensionStatus.APPROVED;
      extension.approvedAt = new Date();
      extension.approvalComment = approvalComment;
      extension.version = extension.version + 1;
      await extension.save({ transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.EXTENSION_APPROVED,
        operator,
        `延期申请通过: ${extension.applicationNo}, 延长 ${extension.extensionDays} 天`
      );

      application.endDate = extension.requestedEndDate;
      await application.save({ transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.IN_PROGRESS,
        operator,
        '延期生效，恢复进行中状态'
      );

      await application.save({ transaction: t });

      await t.commit();

      return { extension, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async rejectExtension(extensionId, rejectionReason, operator = 'system') {
    const extension = await ExtensionApplication.findByPk(extensionId);
    if (!extension) {
      throw new Error('延期申请不存在');
    }

    if (extension.status !== ExtensionStatus.PENDING) {
      throw new StatusValidationError('只有待审批的延期申请才能拒绝');
    }

    const application = await OccupationApplication.findByPk(extension.occupationApplicationId);

    const t = await sequelize.transaction();

    try {
      extension.status = ExtensionStatus.REJECTED;
      extension.isActive = false;
      extension.version = extension.version + 1;
      await extension.save({ transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.EXTENSION_REJECTED,
        operator,
        `延期申请被拒: ${rejectionReason}`
      );

      application.hasActiveExtension = false;
      await application.save({ transaction: t });

      await t.commit();

      return { extension, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async cancelExtension(extensionId, operator = 'system') {
    const extension = await ExtensionApplication.findByPk(extensionId);
    if (!extension) {
      throw new Error('延期申请不存在');
    }

    if (extension.status !== ExtensionStatus.PENDING) {
      throw new StatusValidationError('只有待审批的延期申请才能取消');
    }

    const application = await OccupationApplication.findByPk(extension.occupationApplicationId);

    const t = await sequelize.transaction();

    try {
      extension.status = ExtensionStatus.CANCELLED;
      extension.isActive = false;
      extension.version = extension.version + 1;
      await extension.save({ transaction: t });

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.IN_PROGRESS,
        operator,
        '取消延期申请'
      );

      application.hasActiveExtension = false;
      await application.save({ transaction: t });

      await t.commit();

      return { extension, application };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async getExtension(extensionId) {
    return await ExtensionApplication.findByPk(extensionId, {
      include: [
        { model: OccupationApplication, as: 'occupationApplication' }
      ]
    });
  }

  static async listExtensions(applicationId) {
    return await ExtensionApplication.findAll({
      where: {
        occupationApplicationId: applicationId
      },
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = {
  ExtensionService,
  generateExtensionNo
};
