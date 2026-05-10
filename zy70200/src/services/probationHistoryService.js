const { ProbationHistory } = require('../models');

class ProbationHistoryService {
  static async recordStatusChange(
    probationPlanId,
    employeeId,
    previousStatus,
    newStatus,
    performedBy,
    performedByRole,
    comment,
    metadata = {}
  ) {
    return await ProbationHistory.create({
      probationPlanId,
      employeeId,
      action: 'STATUS_CHANGE',
      previousStatus,
      newStatus,
      performedBy,
      performedByRole,
      comment,
      metadata: {
        ...metadata,
        recordedAt: new Date().toISOString()
      }
    });
  }

  static async recordAction(
    probationPlanId,
    employeeId,
    action,
    performedBy,
    performedByRole,
    comment,
    metadata = {}
  ) {
    return await ProbationHistory.create({
      probationPlanId,
      employeeId,
      action,
      performedBy,
      performedByRole,
      comment,
      metadata: {
        ...metadata,
        recordedAt: new Date().toISOString()
      }
    });
  }

  static async recordRuleCheck(probationPlanId, employeeId, ruleCheckResult, performedBy) {
    return await ProbationHistory.create({
      probationPlanId,
      employeeId,
      action: 'RULE_CHECK',
      performedBy,
      performedByRole: 'SYSTEM',
      comment: `规则检查结果: ${ruleCheckResult.overallResult}`,
      metadata: {
        ruleCheck: ruleCheckResult,
        recordedAt: new Date().toISOString()
      }
    });
  }

  static async recordEvaluationSubmitted(probationPlanId, employeeId, evaluationId, evaluatorId) {
    return await ProbationHistory.create({
      probationPlanId,
      employeeId,
      action: 'EVALUATION_SUBMITTED',
      performedBy: evaluatorId,
      performedByRole: 'EVALUATOR',
      comment: '绩效评价已提交',
      metadata: {
        evaluationId,
        recordedAt: new Date().toISOString()
      }
    });
  }

  static async recordMentorFeedbackSubmitted(probationPlanId, employeeId, feedbackId, mentorId) {
    return await ProbationHistory.create({
      probationPlanId,
      employeeId,
      action: 'MENTOR_FEEDBACK_SUBMITTED',
      performedBy: mentorId,
      performedByRole: 'MENTOR',
      comment: '导师意见已提交',
      metadata: {
        feedbackId,
        recordedAt: new Date().toISOString()
      }
    });
  }

  static async recordExtensionRequested(probationPlanId, employeeId, requestId, requestedBy, reason) {
    return await ProbationHistory.create({
      probationPlanId,
      employeeId,
      action: 'EXTENSION_REQUESTED',
      performedBy: requestedBy,
      comment: `延期申请已提交: ${reason}`,
      metadata: {
        requestId,
        recordedAt: new Date().toISOString()
      }
    });
  }

  static async recordSalaryAdjustment(probationPlanId, employeeId, adjustmentId, previousSalary, newSalary) {
    return await ProbationHistory.create({
      probationPlanId,
      employeeId,
      action: 'SALARY_ADJUSTMENT',
      performedByRole: 'SYSTEM',
      comment: `薪资调整: ${previousSalary} -> ${newSalary}`,
      metadata: {
        adjustmentId,
        previousSalary: parseFloat(previousSalary),
        newSalary: parseFloat(newSalary),
        recordedAt: new Date().toISOString()
      }
    });
  }

  static async getProbationHistory(probationPlanId) {
    return await ProbationHistory.findAll({
      where: { probationPlanId },
      order: [['timestamp', 'DESC']]
    });
  }

  static async getEmployeeProbationHistory(employeeId) {
    return await ProbationHistory.findAll({
      where: { employeeId },
      order: [['timestamp', 'DESC']]
    });
  }
}

module.exports = ProbationHistoryService;
