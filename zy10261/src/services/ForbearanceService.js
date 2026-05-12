const moment = require('moment');
const { ForbearanceApplication, Installment, Contract, sequelize } = require('../models');
const ContractService = require('./ContractService');

class ForbearanceService {
  static async createApplication(applicationData) {
    const {
      contractId,
      installmentId,
      applicantName,
      applicantPhone,
      reason,
      requestedDays,
      partialPaymentAmount,
      sourceId,
      operator,
      remark,
    } = applicationData;

    if (sourceId) {
      const existing = await ForbearanceApplication.findOne({
        where: { sourceId },
      });
      if (existing) {
        return {
          isDuplicate: true,
          application: existing,
          message: '重复提交，该申请已存在',
        };
      }
    }

    const eligibility = await ContractService.calculateForbearanceEligibility(contractId, installmentId);
    if (!eligibility.eligible) {
      throw new Error(`不符合宽限条件: ${eligibility.reasons.join(', ')}`);
    }

    if (requestedDays > eligibility.maxDays) {
      throw new Error(`申请宽限天数(${requestedDays}天)超过最大允许天数(${eligibility.maxDays}天)`);
    }

    const applicationNo = `FBA${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;

    const application = await ForbearanceApplication.create({
      applicationNo,
      contractId,
      installmentId,
      applicantName,
      applicantPhone,
      reason,
      requestedDays,
      partialPaymentAmount,
      sourceId,
      operator,
      remark,
      status: 'pending',
    });

    return {
      isDuplicate: false,
      application,
      eligibility,
      message: '宽限申请提交成功',
    };
  }

  static async approveApplication(applicationId, approvalData) {
    const { approvedDays, approver, approvalRemark } = approvalData;

    const transaction = await sequelize.transaction();

    try {
      const application = await ForbearanceApplication.findByPk(applicationId, {
        include: ['contract', 'installment'],
        transaction,
      });

      if (!application) {
        throw new Error('申请不存在');
      }

      if (application.status !== 'pending') {
        throw new Error('申请已处理，不可重复审批');
      }

      const eligibility = await ContractService.calculateForbearanceEligibility(
        application.contractId,
        application.installmentId
      );
      if (approvedDays > eligibility.maxDays) {
        throw new Error(`审批宽限天数(${approvedDays}天)超过最大允许天数(${eligibility.maxDays}天)`);
      }

      const installment = application.installment;
      const newDueDate = moment(installment.currentDueDate).add(approvedDays, 'days').toDate();

      await ForbearanceApplication.update(
        {
          status: 'approved',
          approvedDays,
          approver,
          approvalRemark,
          approvalTime: new Date(),
        },
        { where: { id: applicationId }, transaction }
      );

      await Installment.update(
        {
          currentDueDate: newDueDate,
          isForborne: true,
          forbearanceCount: installment.forbearanceCount + 1,
          status: 'forborne',
        },
        { where: { id: installment.id }, transaction }
      );

      const contract = application.contract;
      await Contract.update(
        {
          usedForbearanceTimes: contract.usedForbearanceTimes + 1,
        },
        { where: { id: contract.id }, transaction }
      );

      await transaction.commit();

      return await ForbearanceApplication.findByPk(applicationId, {
        include: ['contract', 'installment'],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async rejectApplication(applicationId, rejectionData) {
    const { approver, approvalRemark } = rejectionData;

    const application = await ForbearanceApplication.findByPk(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.status !== 'pending') {
      throw new Error('申请已处理，不可重复审批');
    }

    await ForbearanceApplication.update(
      {
        status: 'rejected',
        approver,
        approvalRemark,
        approvalTime: new Date(),
      },
      { where: { id: applicationId } }
    );

    return await ForbearanceApplication.findByPk(applicationId);
  }

  static async getApplicationDetail(applicationId) {
    const application = await ForbearanceApplication.findByPk(applicationId, {
      include: ['contract', 'installment'],
    });

    if (!application) {
      throw new Error('申请不存在');
    }

    return application;
  }

  static async listApplications(contractId) {
    return await ForbearanceApplication.findAll({
      where: { contractId },
      order: [['createdAt', 'DESC']],
      include: ['installment'],
    });
  }
}

module.exports = ForbearanceService;
