const {
  ProbationRules,
  RuleCheckResult,
  ProbationStatus,
  EvaluationStatus,
  MentorFeedbackStatus,
  SalaryAdjustmentStatus
} = require('../constants');

class ProbationRuleEngine {
  static checkPerformanceScore(performanceScore) {
    const result = {
      rule: 'MIN_PERFORMANCE_SCORE',
      threshold: ProbationRules.MIN_PERFORMANCE_SCORE,
      actual: performanceScore,
      pass: performanceScore >= ProbationRules.MIN_PERFORMANCE_SCORE,
      needsReview: false,
      reason: ''
    };

    if (performanceScore >= ProbationRules.MIN_PERFORMANCE_SCORE) {
      result.reason = `绩效分数 ${performanceScore} 达到最低要求 ${ProbationRules.MIN_PERFORMANCE_SCORE}`;
      result.checkResult = RuleCheckResult.PASS;
    } else {
      result.reason = `绩效分数 ${performanceScore} 低于最低要求 ${ProbationRules.MIN_PERFORMANCE_SCORE}`;
      result.checkResult = RuleCheckResult.FAIL;
    }

    return result;
  }

  static checkMentorFeedbackScore(mentorScore) {
    const result = {
      rule: 'MIN_MENTOR_FEEDBACK_SCORE',
      threshold: ProbationRules.MIN_MENTOR_FEEDBACK_SCORE,
      actual: mentorScore,
      pass: mentorScore >= ProbationRules.MIN_MENTOR_FEEDBACK_SCORE,
      needsReview: false,
      reason: ''
    };

    if (mentorScore >= ProbationRules.MIN_MENTOR_FEEDBACK_SCORE) {
      result.reason = `导师评分 ${mentorScore} 达到最低要求 ${ProbationRules.MIN_MENTOR_FEEDBACK_SCORE}`;
      result.checkResult = RuleCheckResult.PASS;
    } else {
      result.reason = `导师评分 ${mentorScore} 低于最低要求 ${ProbationRules.MIN_MENTOR_FEEDBACK_SCORE}`;
      result.checkResult = RuleCheckResult.FAIL;
    }

    return result;
  }

  static checkExtensionRules(currentExtensionCount, requestedExtensionMonths) {
    const results = [];

    const countCheck = {
      rule: 'MAX_EXTENSION_COUNT',
      threshold: ProbationRules.MAX_EXTENSION_COUNT,
      actual: currentExtensionCount,
      pass: currentExtensionCount < ProbationRules.MAX_EXTENSION_COUNT,
      needsReview: false,
      reason: ''
    };

    if (currentExtensionCount < ProbationRules.MAX_EXTENSION_COUNT) {
      countCheck.reason = `延期次数 ${currentExtensionCount} 未超过最大限制 ${ProbationRules.MAX_EXTENSION_COUNT}`;
      countCheck.checkResult = RuleCheckResult.PASS;
    } else {
      countCheck.reason = `延期次数 ${currentExtensionCount} 已达到最大限制 ${ProbationRules.MAX_EXTENSION_COUNT}`;
      countCheck.checkResult = RuleCheckResult.FAIL;
    }
    results.push(countCheck);

    const monthsCheck = {
      rule: 'MAX_EXTENSION_MONTHS',
      threshold: ProbationRules.MAX_EXTENSION_MONTHS,
      actual: requestedExtensionMonths,
      pass: requestedExtensionMonths <= ProbationRules.MAX_EXTENSION_MONTHS,
      needsReview: false,
      reason: ''
    };

    if (requestedExtensionMonths <= ProbationRules.MAX_EXTENSION_MONTHS) {
      monthsCheck.reason = `延期月数 ${requestedExtensionMonths} 不超过最大限制 ${ProbationRules.MAX_EXTENSION_MONTHS}`;
      monthsCheck.checkResult = RuleCheckResult.PASS;
    } else {
      monthsCheck.reason = `延期月数 ${requestedExtensionMonths} 超过最大限制 ${ProbationRules.MAX_EXTENSION_MONTHS}`;
      monthsCheck.checkResult = RuleCheckResult.FAIL;
    }
    results.push(monthsCheck);

    return results;
  }

  static canRequestExtension(probationPlan) {
    const results = this.checkExtensionRules(
      probationPlan.extensionCount,
      1
    );

    const allPass = results.every(r => r.checkResult === RuleCheckResult.PASS);

    const validStatuses = [
      ProbationStatus.IN_PROGRESS,
      ProbationStatus.AWAITING_EVALUATION,
      ProbationStatus.EVALUATION_COMPLETED,
      ProbationStatus.AWAITING_APPROVAL
    ];

    const statusValid = validStatuses.includes(probationPlan.status);

    return {
      canRequest: allPass && statusValid,
      ruleChecks: results,
      statusCheck: {
        valid: statusValid,
        currentStatus: probationPlan.status,
        allowedStatuses: validStatuses
      }
    };
  }

  static evaluateProbationReadiness(probationPlan, evaluations, mentorFeedbacks) {
    const results = [];
    const allDetails = [];

    const activeEvaluation = evaluations.find(
      e => e.status === EvaluationStatus.APPROVED
    );

    const activeMentorFeedback = mentorFeedbacks.find(
      f => f.status === MentorFeedbackStatus.SUBMITTED
    );

    if (!activeEvaluation) {
      results.push({
        rule: 'HAS_APPROVED_EVALUATION',
        checkResult: RuleCheckResult.FAIL,
        reason: '没有找到已批准的绩效评价',
        needsReview: false
      });
    } else {
      const perfCheck = this.checkPerformanceScore(parseFloat(activeEvaluation.overallScore));
      results.push(perfCheck);
      allDetails.push({
        type: 'performance',
        score: activeEvaluation.overallScore,
        evaluatorId: activeEvaluation.evaluatorId
      });
    }

    if (!activeMentorFeedback) {
      results.push({
        rule: 'HAS_SUBMITTED_MENTOR_FEEDBACK',
        checkResult: RuleCheckResult.FAIL,
        reason: '没有找到已提交的导师意见',
        needsReview: false
      });
    } else {
      const mentorCheck = this.checkMentorFeedbackScore(parseFloat(activeMentorFeedback.overallScore));
      results.push(mentorCheck);
      allDetails.push({
        type: 'mentor',
        score: activeMentorFeedback.overallScore,
        recommendation: activeMentorFeedback.recommendation
      });
    }

    const passResults = results.filter(r => r.checkResult === RuleCheckResult.PASS);
    const failResults = results.filter(r => r.checkResult === RuleCheckResult.FAIL);
    const reviewResults = results.filter(r => r.checkResult === RuleCheckResult.NEEDS_REVIEW);

    let overallResult;
    let recommendedAction;

    if (failResults.length > 0) {
      overallResult = RuleCheckResult.FAIL;
      if (activeMentorFeedback && activeMentorFeedback.recommendation === 'extend') {
        recommendedAction = 'consider_extension';
      } else if (activeMentorFeedback && activeMentorFeedback.recommendation === 'terminate') {
        recommendedAction = 'consider_termination';
      } else {
        recommendedAction = 'manual_review';
      }
    } else if (reviewResults.length > 0) {
      overallResult = RuleCheckResult.NEEDS_REVIEW;
      recommendedAction = 'manual_review';
    } else {
      overallResult = RuleCheckResult.PASS;
      recommendedAction = 'approve_probation';
    }

    return {
      overallResult,
      recommendedAction,
      ruleChecks: results,
      passCount: passResults.length,
      failCount: failResults.length,
      reviewCount: reviewResults.length,
      details: allDetails,
      timestamp: new Date().toISOString()
    };
  }

  static canApproveProbation(probationPlan, evaluation, mentorFeedback) {
    if (probationPlan.status !== ProbationStatus.AWAITING_APPROVAL) {
      return {
        canApprove: false,
        reason: `当前状态 ${probationPlan.status} 不允许审批，仅 ${ProbationStatus.AWAITING_APPROVAL} 状态可审批`
      };
    }

    if (!evaluation || evaluation.status !== EvaluationStatus.APPROVED) {
      return {
        canApprove: false,
        reason: '缺少已批准的绩效评价'
      };
    }

    if (!mentorFeedback || mentorFeedback.status !== MentorFeedbackStatus.SUBMITTED) {
      return {
        canApprove: false,
        reason: '缺少已提交的导师意见'
      };
    }

    return {
      canApprove: true,
      reason: '满足转正审批条件'
    };
  }

  static getValidStatusTransitions() {
    return {
      [ProbationStatus.PENDING]: [ProbationStatus.IN_PROGRESS],
      [ProbationStatus.IN_PROGRESS]: [
        ProbationStatus.AWAITING_EVALUATION,
        ProbationStatus.EXTENSION_REQUESTED,
        ProbationStatus.TERMINATED
      ],
      [ProbationStatus.AWAITING_EVALUATION]: [
        ProbationStatus.EVALUATION_COMPLETED,
        ProbationStatus.EXTENSION_REQUESTED
      ],
      [ProbationStatus.EVALUATION_COMPLETED]: [
        ProbationStatus.AWAITING_APPROVAL,
        ProbationStatus.EXTENSION_REQUESTED
      ],
      [ProbationStatus.AWAITING_APPROVAL]: [
        ProbationStatus.APPROVED,
        ProbationStatus.REJECTED,
        ProbationStatus.EXTENSION_REQUESTED
      ],
      [ProbationStatus.EXTENSION_REQUESTED]: [
        ProbationStatus.EXTENSION_APPROVED,
        ProbationStatus.EXTENSION_REJECTED
      ],
      [ProbationStatus.EXTENSION_APPROVED]: [
        ProbationStatus.IN_PROGRESS
      ],
      [ProbationStatus.EXTENSION_REJECTED]: [
        ProbationStatus.AWAITING_APPROVAL,
        ProbationStatus.TERMINATED
      ],
      [ProbationStatus.APPROVED]: [
        ProbationStatus.CONFIRMED
      ],
      [ProbationStatus.REJECTED]: [
        ProbationStatus.TERMINATED
      ],
      [ProbationStatus.CONFIRMED]: [],
      [ProbationStatus.TERMINATED]: []
    };
  }

  static isValidStatusTransition(fromStatus, toStatus) {
    const transitions = this.getValidStatusTransitions();
    const allowedTransitions = transitions[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  static getAllRules() {
    return {
      performance: {
        minScore: ProbationRules.MIN_PERFORMANCE_SCORE,
        description: '绩效评价最低分数要求'
      },
      mentor: {
        minScore: ProbationRules.MIN_MENTOR_FEEDBACK_SCORE,
        description: '导师意见最低分数要求'
      },
      extension: {
        maxCount: ProbationRules.MAX_EXTENSION_COUNT,
        maxMonths: ProbationRules.MAX_EXTENSION_MONTHS,
        description: '延期次数和月数限制'
      },
      autoConfirm: {
        daysAfterApproval: ProbationRules.AUTO_CONFIRM_DAYS_AFTER_APPROVAL,
        description: '审批通过后自动转正的天数'
      },
      statusTransitions: this.getValidStatusTransitions()
    };
  }
}

module.exports = ProbationRuleEngine;
