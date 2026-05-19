const AppealModel = require('../models/AppealModel');
const ContentModel = require('../models/ContentModel');
const ReviewerModel = require('../models/ReviewerModel');
const { APPEAL_STATUSES, CONTENT_STATUSES, AUDIT_ACTIONS, DISPOSAL_TYPES } = require('../config/constants');

class AppealService {
  static async submitAppeal(data) {
    const content = await ContentModel.getContentById(data.contentId);
    if (!content) {
      throw new Error('内容项不存在');
    }

    if (content.content_status === CONTENT_STATUSES.RESTORED) {
      throw new Error('该内容已恢复，无需申诉');
    }

    const appeal = await AppealModel.createAppeal(data);
    
    await ContentModel.updateContentStatus(data.contentId, CONTENT_STATUSES.APPEALED);
    
    await AppealModel.addAuditTrail(
      appeal.id,
      AUDIT_ACTIONS.CREATE,
      data.submitterId,
      data.submitterName,
      '提交申诉申请',
      null,
      APPEAL_STATUSES.PENDING
    );

    return appeal;
  }

  static async assignReviewer(appealId, operatorId, operatorName) {
    const appeal = await AppealModel.getAppealById(appealId);
    if (!appeal) {
      throw new Error('申诉不存在');
    }

    if (appeal.status !== APPEAL_STATUSES.PENDING) {
      throw new Error('只有待处理状态的申诉才能分派');
    }

    const reviewers = await ReviewerModel.getAllActiveReviewers();
    if (reviewers.length === 0) {
      throw new Error('没有可用的审核人员');
    }

    const selectedReviewer = reviewers[0];
    
    await AppealModel.updateAppealStatus(
      appealId,
      APPEAL_STATUSES.REVIEWING,
      selectedReviewer.id,
      selectedReviewer.name
    );

    await ReviewerModel.incrementWorkload(selectedReviewer.id);

    await AppealModel.addAuditTrail(
      appealId,
      AUDIT_ACTIONS.ASSIGN,
      operatorId,
      operatorName,
      `分派给审核员: ${selectedReviewer.name}`,
      APPEAL_STATUSES.PENDING,
      APPEAL_STATUSES.REVIEWING
    );

    return { appealId, assignee: selectedReviewer };
  }

  static async manualAssign(appealId, reviewerId, operatorId, operatorName) {
    const appeal = await AppealModel.getAppealById(appealId);
    if (!appeal) {
      throw new Error('申诉不存在');
    }

    const reviewer = await ReviewerModel.getReviewerById(reviewerId);
    if (!reviewer) {
      throw new Error('审核人员不存在');
    }

    const oldStatus = appeal.status;

    await AppealModel.updateAppealStatus(
      appealId,
      APPEAL_STATUSES.REVIEWING,
      reviewer.id,
      reviewer.name
    );

    await ReviewerModel.incrementWorkload(reviewerId);

    await AppealModel.addAuditTrail(
      appealId,
      AUDIT_ACTIONS.ASSIGN,
      operatorId,
      operatorName,
      `手动分派给审核员: ${reviewer.name}`,
      oldStatus,
      APPEAL_STATUSES.REVIEWING
    );

    return { appealId, assignee: reviewer };
  }

  static async approveAppeal(appealId, disposalNote, operatorId, operatorName) {
    const appeal = await AppealModel.getAppealById(appealId);
    if (!appeal) {
      throw new Error('申诉不存在');
    }

    if (appeal.status !== APPEAL_STATUSES.REVIEWING) {
      throw new Error('只有审核中状态的申诉才能通过');
    }

    await AppealModel.updateAppealStatus(appealId, APPEAL_STATUSES.APPROVED);
    await AppealModel.updateDisposal(appealId, DISPOSAL_TYPES.RESTORE, disposalNote);
    await ContentModel.updateContentStatus(appeal.content_id, CONTENT_STATUSES.RESTORED);

    if (appeal.assignee_id) {
      await ReviewerModel.decrementWorkload(appeal.assignee_id);
    }

    await AppealModel.addAuditTrail(
      appealId,
      AUDIT_ACTIONS.APPROVE,
      operatorId,
      operatorName,
      disposalNote,
      APPEAL_STATUSES.REVIEWING,
      APPEAL_STATUSES.APPROVED
    );

    return { appealId, status: APPEAL_STATUSES.APPROVED };
  }

  static async rejectAppeal(appealId, disposalNote, operatorId, operatorName) {
    const appeal = await AppealModel.getAppealById(appealId);
    if (!appeal) {
      throw new Error('申诉不存在');
    }

    if (appeal.status !== APPEAL_STATUSES.REVIEWING) {
      throw new Error('只有审核中状态的申诉才能驳回');
    }

    await AppealModel.updateAppealStatus(appealId, APPEAL_STATUSES.REJECTED);
    await AppealModel.updateDisposal(appealId, DISPOSAL_TYPES.MAINTAIN_BLOCK, disposalNote);
    await ContentModel.updateContentStatus(appeal.content_id, CONTENT_STATUSES.PERMANENT_BLOCKED);

    if (appeal.assignee_id) {
      await ReviewerModel.decrementWorkload(appeal.assignee_id);
    }

    await AppealModel.addAuditTrail(
      appealId,
      AUDIT_ACTIONS.REJECT,
      operatorId,
      operatorName,
      disposalNote,
      APPEAL_STATUSES.REVIEWING,
      APPEAL_STATUSES.REJECTED
    );

    return { appealId, status: APPEAL_STATUSES.REJECTED };
  }

  static async escalateAppeal(appealId, operatorId, operatorName) {
    const appeal = await AppealModel.getAppealById(appealId);
    if (!appeal) {
      throw new Error('申诉不存在');
    }

    if (appeal.status !== APPEAL_STATUSES.REVIEWING) {
      throw new Error('只有审核中状态的申诉才能升级');
    }

    const oldStatus = appeal.status;
    await AppealModel.updateAppealStatus(appealId, APPEAL_STATUSES.ESCALATED);

    await AppealModel.addAuditTrail(
      appealId,
      AUDIT_ACTIONS.ESCALATE,
      operatorId,
      operatorName,
      '升级至高级审核团队',
      oldStatus,
      APPEAL_STATUSES.ESCALATED
    );

    return { appealId, status: APPEAL_STATUSES.ESCALATED };
  }

  static async getAppealDetail(appealId) {
    const appeal = await AppealModel.getAppealById(appealId);
    if (!appeal) {
      throw new Error('申诉不存在');
    }

    const content = await ContentModel.getContentById(appeal.content_id);
    const auditTags = await ContentModel.getAuditTags(appeal.content_id);
    const modelReasons = await ContentModel.getModelReasons(appeal.content_id);
    const auditTrail = await AppealModel.getAuditTrail(appealId);

    return {
      appeal,
      content,
      auditTags,
      modelReasons,
      auditTrail
    };
  }

  static async syncAuditResult(contentId, auditData) {
    const content = await ContentModel.getContentById(contentId);
    if (!content) {
      throw new Error('内容项不存在');
    }

    for (const tag of auditData.tags || []) {
      await ContentModel.addAuditTag(
        contentId,
        tag.code,
        tag.name,
        tag.confidence
      );
    }

    for (const reason of auditData.modelReasons || []) {
      await ContentModel.addModelReason(
        contentId,
        reason.modelVersion,
        reason.code,
        reason.detail,
        reason.riskLevel,
        JSON.stringify(reason.evidence || [])
      );
    }

    return { contentId, synced: true };
  }
}

module.exports = AppealService;
