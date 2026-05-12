const { seals, applications, SealApplication } = require('../models/Seal');

class SealService {
  static getAllSeals() {
    return Array.from(seals.values());
  }

  static getSealById(id) {
    return seals.get(id);
  }

  static createApplication(data) {
    const { sealId, applicantId, applicantName, purpose, expectedLendDate, expectedReturnDate, reason } = data;

    if (!seals.has(sealId)) {
      throw new Error('印章不存在');
    }

    if (new Date(expectedReturnDate) < new Date(expectedLendDate)) {
      throw new Error('预计归还日期不能早于预计借出日期');
    }

    const pendingOrApprovedForSameSeal = Array.from(applications.values()).filter(
      app => app.sealId === sealId && 
             app.applicantId === applicantId &&
             (app.status === 'pending' || app.status === 'approved' || app.status === 'lent') &&
             app.purpose === purpose
    );

    if (pendingOrApprovedForSameSeal.length > 0) {
      throw new Error('该印章已有相同目的的待审批或已审批申请，请勿重复提交');
    }

    const application = new SealApplication(
      sealId,
      applicantId,
      applicantName,
      purpose,
      expectedLendDate,
      expectedReturnDate,
      reason
    );

    applications.set(application.id, application);
    return application;
  }

  static approveApplication(applicationId, approverId, approverName, remark) {
    const application = applications.get(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.status !== 'pending') {
      throw new Error('只有待审批的申请可以审批');
    }

    if (application.applicantId === approverId) {
      throw new Error('审批人不能与申请人相同');
    }

    const lentApplications = Array.from(applications.values()).filter(
      app => app.sealId === application.sealId && app.status === 'lent'
    );
    if (lentApplications.length > 0) {
      throw new Error('该印章当前已被借出，无法审批通过');
    }

    application.status = 'approved';
    application.approverId = approverId;
    application.approverName = approverName;
    application.approvalTime = new Date().toISOString();
    application.approvalRemark = remark;
    application.updatedAt = new Date().toISOString();

    return application;
  }

  static rejectApplication(applicationId, approverId, approverName, reason) {
    const application = applications.get(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.status !== 'pending') {
      throw new Error('只有待审批的申请可以驳回');
    }

    application.status = 'rejected';
    application.approverId = approverId;
    application.approverName = approverName;
    application.approvalTime = new Date().toISOString();
    application.approvalRemark = reason;
    application.updatedAt = new Date().toISOString();

    return application;
  }

  static lendSeal(applicationId, lenderId, lenderName, actualLendDate) {
    const application = applications.get(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.status !== 'approved') {
      throw new Error('只有审批通过的申请才能出借');
    }

    const lentApplications = Array.from(applications.values()).filter(
      app => app.sealId === application.sealId && 
             app.status === 'lent' && 
             app.id !== applicationId
    );
    if (lentApplications.length > 0) {
      throw new Error('该印章当前已被借出，无法重复出借');
    }

    application.status = 'lent';
    application.lenderId = lenderId;
    application.lenderName = lenderName;
    application.actualLendDate = actualLendDate || new Date().toISOString();
    application.updatedAt = new Date().toISOString();

    const seal = seals.get(application.sealId);
    if (seal) {
      seal.status = 'lent';
    }

    return application;
  }

  static returnSeal(applicationId, returnerId, returnerName, actualReturnDate) {
    const application = applications.get(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.status !== 'lent') {
      throw new Error('只有已出借的印章才能归还');
    }

    const returnDate = actualReturnDate ? new Date(actualReturnDate) : new Date();
    const lendDate = new Date(application.actualLendDate);

    if (returnDate < lendDate) {
      throw new Error('实际归还日期不能早于实际借出日期');
    }

    application.status = 'returned';
    application.returnerId = returnerId;
    application.returnerName = returnerName;
    application.actualReturnDate = returnDate.toISOString();
    application.updatedAt = new Date().toISOString();

    const seal = seals.get(application.sealId);
    if (seal) {
      seal.status = 'available';
    }

    return application;
  }

  static getApplicationById(id) {
    return applications.get(id);
  }

  static getAllApplications(filters = {}) {
    let result = Array.from(applications.values());

    if (filters.status) {
      result = result.filter(app => app.status === filters.status);
    }

    if (filters.sealId) {
      result = result.filter(app => app.sealId === filters.sealId);
    }

    if (filters.applicantId) {
      result = result.filter(app => app.applicantId === filters.applicantId);
    }

    return result;
  }

  static getOverdueApplications() {
    const now = new Date();
    return Array.from(applications.values()).filter(
      app => app.status === 'lent' && new Date(app.expectedReturnDate) < now
    );
  }

  static getUsageRecords(startDate, endDate) {
    let result = Array.from(applications.values()).filter(
      app => app.status === 'returned' || app.status === 'lent'
    );

    if (startDate) {
      result = result.filter(app => new Date(app.actualLendDate) >= new Date(startDate));
    }

    if (endDate) {
      result = result.filter(app => new Date(app.actualLendDate) <= new Date(endDate));
    }

    return result.map(app => ({
      applicationId: app.id,
      sealId: app.sealId,
      sealName: seals.get(app.sealId)?.name || '未知',
      applicantId: app.applicantId,
      applicantName: app.applicantName,
      purpose: app.purpose,
      approverName: app.approverName,
      actualLendDate: app.actualLendDate,
      actualReturnDate: app.actualReturnDate,
      status: app.status
    }));
  }
}

module.exports = SealService;