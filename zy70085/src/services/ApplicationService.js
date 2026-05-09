const { v4: uuidv4 } = require('uuid');
const { OccupationApplication, RoadSection, sequelize } = require('../models');
const { ApplicationStatus, RoadSectionStatus } = require('../constants/status');
const { StatusManager, StatusValidationError } = require('./StatusManager');

function generateApplicationNo(prefix = 'OCC') {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}${month}${day}-${random}`;
}

class ApplicationService {
  static async createDraft(data, operator = 'system') {
    const {
      contractorId, contractorName, projectName, projectType,
      roadSectionId, occupiedLength, occupiedLanes,
      startDate, endDate, purpose
    } = data;

    const roadSection = await RoadSection.findByPk(roadSectionId);
    if (!roadSection) {
      throw new Error('路段不存在');
    }

    if (occupiedLength > roadSection.availableLength) {
      throw new Error('占用长度超过可用长度');
    }

    if (occupiedLanes > roadSection.lanes) {
      throw new Error('占用车道数超过总车道数');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new Error('开始日期必须早于结束日期');
    }

    const application = await OccupationApplication.create({
      applicationNo: generateApplicationNo(),
      contractorId,
      contractorName,
      projectName,
      projectType,
      roadSectionId,
      occupiedLength,
      occupiedLanes,
      startDate: start,
      endDate: end,
      originalEndDate: end,
      purpose,
      status: ApplicationStatus.DRAFT,
      version: 1,
      metadata: {
        createdBy: operator,
        createdAt: new Date().toISOString()
      }
    });

    return application;
  }

  static async submitApplication(applicationId, operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    await StatusManager.validateApplicationState(application, ApplicationStatus.SUBMITTED);

    await StatusManager.logStatusChange(
      application,
      'OccupationApplication',
      ApplicationStatus.SUBMITTED,
      operator,
      '提交申请'
    );

    application.submittedAt = new Date();

    await application.save();

    return application;
  }

  static async approveApplication(applicationId, approvalComment = '', operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId, {
      include: [{ model: RoadSection, as: 'roadSection' }]
    });
    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.status !== ApplicationStatus.SUBMITTED) {
      throw new StatusValidationError('只有已提交的申请才能审批');
    }

    const roadSection = application.roadSection;

    const t = await sequelize.transaction();

    try {
      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.APPROVED,
        operator,
        approvalComment
      );

      application.approvedAt = new Date();
      application.approvalComment = approvalComment;
      await application.save({ transaction: t });

      const newAvailableLength = roadSection.availableLength - application.occupiedLength;
      let newStatus = RoadSectionStatus.AVAILABLE;

      if (newAvailableLength <= 0) {
        newStatus = RoadSectionStatus.OCCUPIED;
      } else if (newAvailableLength < roadSection.totalLength) {
        newStatus = RoadSectionStatus.PARTIALLY_OCCUPIED;
      }

      await roadSection.update({
        availableLength: newAvailableLength,
        status: newStatus
      }, { transaction: t });

      await t.commit();

      return application;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async rejectApplication(applicationId, rejectionReason, operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    await StatusManager.validateApplicationState(application, ApplicationStatus.REJECTED);

    await StatusManager.logStatusChange(
      application,
      'OccupationApplication',
      ApplicationStatus.REJECTED,
      operator,
      rejectionReason
    );

    application.rejectionReason = rejectionReason;

    await application.save();

    return application;
  }

  static async startOccupation(applicationId, operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    await StatusManager.validateApplicationState(application, ApplicationStatus.IN_PROGRESS);

    await StatusManager.logStatusChange(
      application,
      'OccupationApplication',
      ApplicationStatus.IN_PROGRESS,
      operator,
      '开始占道施工'
    );

    await application.save();

    return application;
  }

  static async cancelApplication(applicationId, operator = 'system') {
    const application = await OccupationApplication.findByPk(applicationId, {
      include: [{ model: RoadSection, as: 'roadSection' }]
    });
    if (!application) {
      throw new Error('申请不存在');
    }

    const canCancelStatuses = [
      ApplicationStatus.DRAFT,
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.APPROVED,
      ApplicationStatus.IN_PROGRESS
    ];

    if (!canCancelStatuses.includes(application.status)) {
      throw new StatusValidationError('当前状态无法撤销');
    }

    const t = await sequelize.transaction();

    try {
      if (application.status === ApplicationStatus.APPROVED ||
          application.status === ApplicationStatus.IN_PROGRESS) {
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
      }

      await StatusManager.logStatusChange(
        application,
        'OccupationApplication',
        ApplicationStatus.CANCELLED,
        operator,
        '用户撤销申请'
      );

      await application.save({ transaction: t });

      await t.commit();

      return application;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async getApplication(applicationId) {
    return await OccupationApplication.findByPk(applicationId, {
      include: [
        { model: RoadSection, as: 'roadSection' }
      ]
    });
  }

  static async listApplications(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.contractorId) {
      where.contractorId = filters.contractorId;
    }

    if (filters.roadSectionId) {
      where.roadSectionId = filters.roadSectionId;
    }

    return await OccupationApplication.findAll({
      where,
      include: [
        { model: RoadSection, as: 'roadSection' }
      ],
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = {
  ApplicationService,
  generateApplicationNo
};
