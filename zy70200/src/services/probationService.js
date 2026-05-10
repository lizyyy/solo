const { Op } = require('sequelize');
const dayjs = require('dayjs');
const {
  ProbationPlan,
  Employee,
  PerformanceEvaluation,
  MentorFeedback,
  SalaryAdjustment,
  ExtensionRequest
} = require('../models');
const {
  ProbationStatus,
  EvaluationStatus,
  MentorFeedbackStatus,
  SalaryAdjustmentStatus,
  ApprovalResult,
  RuleCheckResult
} = require('../constants');
const ProbationRuleEngine = require('./probationRuleEngine');
const ProbationHistoryService = require('./probationHistoryService');
const SalaryEffectWorker = require('../workers/salaryEffectWorker');

class ProbationService {
  static async createProbationPlan(data, createdBy) {
    const {
      employeeId,
      mentorId,
      startDate,
      durationMonths,
      goals,
      requirements,
      notes
    } = data;

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      throw new Error('未找到员工');
    }

    const mentor = await Employee.findByPk(mentorId);
    if (!mentor) {
      throw new Error('未找到导师');
    }

    const existingPlan = await ProbationPlan.findOne({
      where: {
        employeeId,
        status: {
          [Op.notIn]: [ProbationStatus.CONFIRMED, ProbationStatus.TERMINATED]
        }
      }
    });

    if (existingPlan) {
      throw new Error('该员工已有进行中的试用期计划');
    }

    const start = dayjs(startDate);
    const endDate = start.add(durationMonths, 'month').format('YYYY-MM-DD');

    const plan = await ProbationPlan.create({
      employeeId,
      mentorId,
      startDate,
      originalEndDate: endDate,
      currentEndDate: endDate,
      durationMonths,
      status: ProbationStatus.PENDING,
      extensionCount: 0,
      goals,
      requirements,
      notes
    });

    await ProbationHistoryService.recordAction(
      plan.id,
      employeeId,
      'PLAN_CREATED',
      createdBy,
      'HR',
      '试用期计划已创建',
      {
        mentorId,
        startDate,
        endDate,
        durationMonths
      }
    );

    return plan;
  }

  static async startProbation(planId, startedBy) {
    const plan = await ProbationPlan.findByPk(planId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    const previousStatus = plan.status;
    if (!ProbationRuleEngine.isValidStatusTransition(previousStatus, ProbationStatus.IN_PROGRESS)) {
      throw new Error(`无法从状态 ${previousStatus} 启动试用期`);
    }

    plan.status = ProbationStatus.IN_PROGRESS;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      planId,
      plan.employeeId,
      previousStatus,
      ProbationStatus.IN_PROGRESS,
      startedBy,
      'HR',
      '试用期已启动'
    );

    return plan;
  }

  static async getProbationPlan(planId) {
    const plan = await ProbationPlan.findByPk(planId, {
      include: [
        { model: Employee, as: 'employee' },
        { model: Employee, as: 'mentor' },
        { model: PerformanceEvaluation, as: 'evaluations' },
        { model: MentorFeedback, as: 'mentorFeedbacks' },
        { model: SalaryAdjustment, as: 'salaryAdjustments' },
        { model: ExtensionRequest, as: 'extensionRequests' }
      ]
    });

    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    return plan;
  }

  static async getEmployeeProbationPlans(employeeId) {
    return await ProbationPlan.findAll({
      where: { employeeId },
      order: [['createdAt', 'DESC']],
      include: [
        { model: Employee, as: 'employee' },
        { model: Employee, as: 'mentor' }
      ]
    });
  }

  static async getProbationPlansByStatus(status) {
    const where = status ? { status } : {};
    return await ProbationPlan.findAll({
      where,
      order: [['currentEndDate', 'ASC']],
      include: [
        { model: Employee, as: 'employee' },
        { model: Employee, as: 'mentor' }
      ]
    });
  }

  static async submitPerformanceEvaluation(data, submittedBy) {
    const {
      probationPlanId,
      evaluatorId,
      overallScore,
      workQualityScore,
      workEfficiencyScore,
      collaborationScore,
      learningAbilityScore,
      comments,
      strengths,
      areasForImprovement
    } = data;

    const plan = await ProbationPlan.findByPk(probationPlanId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    const validStatuses = [
      ProbationStatus.IN_PROGRESS,
      ProbationStatus.AWAITING_EVALUATION
    ];

    if (!validStatuses.includes(plan.status)) {
      throw new Error(`当前状态 ${plan.status} 不允许提交绩效评价`);
    }

    const evaluator = await Employee.findByPk(evaluatorId);
    if (!evaluator) {
      throw new Error('未找到评价人');
    }

    const existingEvaluation = await PerformanceEvaluation.findOne({
      where: {
        probationPlanId,
        status: {
          [Op.in]: [EvaluationStatus.PENDING, EvaluationStatus.SUBMITTED]
        }
      }
    });

    let evaluation;
    if (existingEvaluation) {
      existingEvaluation.evaluatorId = evaluatorId;
      existingEvaluation.overallScore = overallScore;
      existingEvaluation.workQualityScore = workQualityScore;
      existingEvaluation.workEfficiencyScore = workEfficiencyScore;
      existingEvaluation.collaborationScore = collaborationScore;
      existingEvaluation.learningAbilityScore = learningAbilityScore;
      existingEvaluation.comments = comments;
      existingEvaluation.strengths = strengths;
      existingEvaluation.areasForImprovement = areasForImprovement;
      existingEvaluation.status = EvaluationStatus.SUBMITTED;
      existingEvaluation.submittedAt = new Date();
      evaluation = await existingEvaluation.save();
    } else {
      evaluation = await PerformanceEvaluation.create({
        probationPlanId,
        evaluatorId,
        overallScore,
        workQualityScore,
        workEfficiencyScore,
        collaborationScore,
        learningAbilityScore,
        comments,
        strengths,
        areasForImprovement,
        status: EvaluationStatus.SUBMITTED,
        submittedAt: new Date()
      });
    }

    await ProbationHistoryService.recordEvaluationSubmitted(
      probationPlanId,
      plan.employeeId,
      evaluation.id,
      evaluatorId
    );

    return evaluation;
  }

  static async approvePerformanceEvaluation(evaluationId, approvedBy) {
    const evaluation = await PerformanceEvaluation.findByPk(evaluationId);
    if (!evaluation) {
      throw new Error('未找到绩效评价');
    }

    if (evaluation.status !== EvaluationStatus.SUBMITTED) {
      throw new Error(`评价状态 ${evaluation.status} 不允许审批`);
    }

    evaluation.status = EvaluationStatus.APPROVED;
    evaluation.approvedBy = approvedBy;
    evaluation.approvedAt = new Date();
    await evaluation.save();

    const plan = await ProbationPlan.findByPk(evaluation.probationPlanId);
    if (plan) {
      await this.checkEvaluationComplete(plan.id);
    }

    return evaluation;
  }

  static async submitMentorFeedback(data, mentorId) {
    const {
      probationPlanId,
      overallScore,
      skillProgressScore,
      attitudeScore,
      teamworkScore,
      goalsAchieved,
      challengesFaced,
      suggestions,
      recommendation,
      additionalComments
    } = data;

    const plan = await ProbationPlan.findByPk(probationPlanId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    if (plan.mentorId !== mentorId) {
      throw new Error('只有指定导师才能提交导师意见');
    }

    const validStatuses = [
      ProbationStatus.IN_PROGRESS,
      ProbationStatus.AWAITING_EVALUATION,
      ProbationStatus.EVALUATION_COMPLETED
    ];

    if (!validStatuses.includes(plan.status)) {
      throw new Error(`当前状态 ${plan.status} 不允许提交导师意见`);
    }

    const existingFeedback = await MentorFeedback.findOne({
      where: {
        probationPlanId,
        mentorId,
        status: {
          [Op.in]: [MentorFeedbackStatus.PENDING, MentorFeedbackStatus.SUBMITTED]
        }
      }
    });

    let feedback;
    if (existingFeedback) {
      existingFeedback.overallScore = overallScore;
      existingFeedback.skillProgressScore = skillProgressScore;
      existingFeedback.attitudeScore = attitudeScore;
      existingFeedback.teamworkScore = teamworkScore;
      existingFeedback.goalsAchieved = goalsAchieved;
      existingFeedback.challengesFaced = challengesFaced;
      existingFeedback.suggestions = suggestions;
      existingFeedback.recommendation = recommendation;
      existingFeedback.additionalComments = additionalComments;
      existingFeedback.status = MentorFeedbackStatus.SUBMITTED;
      existingFeedback.submittedAt = new Date();
      feedback = await existingFeedback.save();
    } else {
      feedback = await MentorFeedback.create({
        probationPlanId,
        mentorId,
        overallScore,
        skillProgressScore,
        attitudeScore,
        teamworkScore,
        goalsAchieved,
        challengesFaced,
        suggestions,
        recommendation,
        additionalComments,
        status: MentorFeedbackStatus.SUBMITTED,
        submittedAt: new Date()
      });
    }

    await ProbationHistoryService.recordMentorFeedbackSubmitted(
      probationPlanId,
      plan.employeeId,
      feedback.id,
      mentorId
    );

    await this.checkEvaluationComplete(probationPlanId);

    return feedback;
  }

  static async checkEvaluationComplete(planId) {
    const plan = await ProbationPlan.findByPk(planId);
    if (!plan) {
      return;
    }

    const evaluations = await PerformanceEvaluation.findAll({
      where: { probationPlanId: planId }
    });

    const mentorFeedbacks = await MentorFeedback.findAll({
      where: { probationPlanId: planId }
    });

    const hasApprovedEvaluation = evaluations.some(
      e => e.status === EvaluationStatus.APPROVED
    );

    const hasSubmittedMentorFeedback = mentorFeedbacks.some(
      f => f.status === MentorFeedbackStatus.SUBMITTED
    );

    const previousStatus = plan.status;

    if (hasApprovedEvaluation && hasSubmittedMentorFeedback) {
      if (previousStatus !== ProbationStatus.EVALUATION_COMPLETED) {
        plan.status = ProbationStatus.EVALUATION_COMPLETED;
        await plan.save();

        await ProbationHistoryService.recordStatusChange(
          planId,
          plan.employeeId,
          previousStatus,
          ProbationStatus.EVALUATION_COMPLETED,
          null,
          'SYSTEM',
          '评价收集已完成，可提交转正审批'
        );
      }
    } else if (hasApprovedEvaluation || hasSubmittedMentorFeedback) {
      if (previousStatus === ProbationStatus.IN_PROGRESS) {
        plan.status = ProbationStatus.AWAITING_EVALUATION;
        await plan.save();

        await ProbationHistoryService.recordStatusChange(
          planId,
          plan.employeeId,
          previousStatus,
          ProbationStatus.AWAITING_EVALUATION,
          null,
          'SYSTEM',
          '部分评价已收集，等待剩余评价'
        );
      }
    }
  }

  static async submitForApproval(planId, submittedBy) {
    const plan = await ProbationPlan.findByPk(planId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    const validStatuses = [
      ProbationStatus.EVALUATION_COMPLETED,
      ProbationStatus.EXTENSION_REJECTED
    ];

    if (!validStatuses.includes(plan.status)) {
      throw new Error(`当前状态 ${plan.status} 不允许提交审批`);
    }

    const evaluations = await PerformanceEvaluation.findAll({
      where: { probationPlanId: planId }
    });

    const mentorFeedbacks = await MentorFeedback.findAll({
      where: { probationPlanId: planId }
    });

    const ruleCheck = ProbationRuleEngine.evaluateProbationReadiness(
      plan,
      evaluations,
      mentorFeedbacks
    );

    await ProbationHistoryService.recordRuleCheck(
      planId,
      plan.employeeId,
      ruleCheck,
      submittedBy
    );

    const previousStatus = plan.status;
    plan.status = ProbationStatus.AWAITING_APPROVAL;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      planId,
      plan.employeeId,
      previousStatus,
      ProbationStatus.AWAITING_APPROVAL,
      submittedBy,
      'MANAGER',
      '已提交转正审批',
      { ruleCheck }
    );

    return {
      plan,
      ruleCheck,
      shouldReview: ruleCheck.overallResult !== RuleCheckResult.PASS
    };
  }

  static async approveProbation(planId, approvedBy, salaryData) {
    const plan = await ProbationPlan.findByPk(planId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    if (plan.status !== ProbationStatus.AWAITING_APPROVAL) {
      throw new Error(`当前状态 ${plan.status} 不允许审批通过`);
    }

    const evaluations = await PerformanceEvaluation.findAll({
      where: { probationPlanId: planId }
    });

    const mentorFeedbacks = await MentorFeedback.findAll({
      where: { probationPlanId: planId }
    });

    const activeEvaluation = evaluations.find(
      e => e.status === EvaluationStatus.APPROVED
    );

    const activeMentorFeedback = mentorFeedbacks.find(
      f => f.status === MentorFeedbackStatus.SUBMITTED
    );

    const approvalCheck = ProbationRuleEngine.canApproveProbation(
      plan,
      activeEvaluation,
      activeMentorFeedback
    );

    if (!approvalCheck.canApprove) {
      throw new Error(approvalCheck.reason);
    }

    const previousStatus = plan.status;
    plan.status = ProbationStatus.APPROVED;
    plan.approvedBy = approvedBy;
    plan.approvedAt = new Date();
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      planId,
      plan.employeeId,
      previousStatus,
      ProbationStatus.APPROVED,
      approvedBy,
      'MANAGER',
      '转正审批已通过'
    );

    let salaryAdjustment = null;
    if (salaryData && salaryData.newSalary) {
      salaryAdjustment = await this.createSalaryAdjustment(
        planId,
        plan.employeeId,
        salaryData,
        approvedBy
      );
    }

    await this.confirmProbation(planId, approvedBy);

    return {
      plan,
      salaryAdjustment
    };
  }

  static async confirmProbation(planId, confirmedBy) {
    const plan = await ProbationPlan.findByPk(planId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    if (plan.status !== ProbationStatus.APPROVED) {
      throw new Error(`当前状态 ${plan.status} 不允许确认转正`);
    }

    const previousStatus = plan.status;
    plan.status = ProbationStatus.CONFIRMED;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      planId,
      plan.employeeId,
      previousStatus,
      ProbationStatus.CONFIRMED,
      confirmedBy,
      'SYSTEM',
      '已确认转正'
    );

    return plan;
  }

  static async rejectProbation(planId, rejectedBy, reason) {
    const plan = await ProbationPlan.findByPk(planId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    if (plan.status !== ProbationStatus.AWAITING_APPROVAL) {
      throw new Error(`当前状态 ${plan.status} 不允许审批拒绝`);
    }

    const previousStatus = plan.status;
    plan.status = ProbationStatus.REJECTED;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      planId,
      plan.employeeId,
      previousStatus,
      ProbationStatus.REJECTED,
      rejectedBy,
      'MANAGER',
      `转正审批被拒绝: ${reason}`
    );

    return plan;
  }

  static async requestExtension(data, requestedBy) {
    const {
      probationPlanId,
      extensionMonths,
      reason,
      improvementPlan
    } = data;

    const plan = await ProbationPlan.findByPk(probationPlanId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    const extensionCheck = ProbationRuleEngine.canRequestExtension(plan);
    if (!extensionCheck.canRequest) {
      throw new Error('不满足延期申请条件');
    }

    const extensionRuleCheck = ProbationRuleEngine.checkExtensionRules(
      plan.extensionCount,
      extensionMonths
    );

    const rulesPass = extensionRuleCheck.every(
      r => r.checkResult === RuleCheckResult.PASS
    );

    if (!rulesPass) {
      const failedRules = extensionRuleCheck.filter(
        r => r.checkResult !== RuleCheckResult.PASS
      );
      throw new Error(`延期规则检查失败: ${failedRules.map(r => r.reason).join('; ')}`);
    }

    const newEndDate = dayjs(plan.currentEndDate)
      .add(extensionMonths, 'month')
      .format('YYYY-MM-DD');

    const request = await ExtensionRequest.create({
      probationPlanId,
      employeeId: plan.employeeId,
      requestedBy,
      extensionMonths,
      newEndDate,
      reason,
      improvementPlan
    });

    const previousStatus = plan.status;
    plan.status = ProbationStatus.EXTENSION_REQUESTED;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      probationPlanId,
      plan.employeeId,
      previousStatus,
      ProbationStatus.EXTENSION_REQUESTED,
      requestedBy,
      'MANAGER',
      `已申请延期 ${extensionMonths} 个月`,
      {
        requestId: request.id,
        newEndDate,
        reason,
        ruleChecks: extensionRuleCheck
      }
    );

    await ProbationHistoryService.recordExtensionRequested(
      probationPlanId,
      plan.employeeId,
      request.id,
      requestedBy,
      reason
    );

    return {
      request,
      ruleChecks: extensionRuleCheck
    };
  }

  static async approveExtension(requestId, approvedBy, mentorRecommendation) {
    const request = await ExtensionRequest.findByPk(requestId);
    if (!request) {
      throw new Error('未找到延期申请');
    }

    if (request.status) {
      throw new Error('延期申请已处理');
    }

    const plan = await ProbationPlan.findByPk(request.probationPlanId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    if (plan.status !== ProbationStatus.EXTENSION_REQUESTED) {
      throw new Error(`当前状态 ${plan.status} 不允许审批延期`);
    }

    request.status = ApprovalResult.APPROVED;
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    request.mentorRecommendation = mentorRecommendation;
    await request.save();

    const previousStatus = plan.status;
    plan.currentEndDate = request.newEndDate;
    plan.extensionCount += 1;
    plan.status = ProbationStatus.EXTENSION_APPROVED;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      plan.id,
      plan.employeeId,
      previousStatus,
      ProbationStatus.EXTENSION_APPROVED,
      approvedBy,
      'HR',
      `延期申请已通过，新结束日期: ${request.newEndDate}`,
      {
        requestId: request.id,
        extensionMonths: request.extensionMonths,
        newEndDate: request.newEndDate
      }
    );

    plan.status = ProbationStatus.IN_PROGRESS;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      plan.id,
      plan.employeeId,
      ProbationStatus.EXTENSION_APPROVED,
      ProbationStatus.IN_PROGRESS,
      null,
      'SYSTEM',
      '试用期继续进行中'
    );

    return { request, plan };
  }

  static async rejectExtension(requestId, rejectedBy, reason) {
    const request = await ExtensionRequest.findByPk(requestId);
    if (!request) {
      throw new Error('未找到延期申请');
    }

    if (request.status) {
      throw new Error('延期申请已处理');
    }

    const plan = await ProbationPlan.findByPk(request.probationPlanId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    if (plan.status !== ProbationStatus.EXTENSION_REQUESTED) {
      throw new Error(`当前状态 ${plan.status} 不允许拒绝延期`);
    }

    request.status = ApprovalResult.REJECTED;
    request.rejectedBy = rejectedBy;
    request.rejectedAt = new Date();
    await request.save();

    const previousStatus = plan.status;
    plan.status = ProbationStatus.EXTENSION_REJECTED;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      plan.id,
      plan.employeeId,
      previousStatus,
      ProbationStatus.EXTENSION_REJECTED,
      rejectedBy,
      'HR',
      `延期申请被拒绝: ${reason}`
    );

    return { request, plan };
  }

  static async createSalaryAdjustment(planId, employeeId, salaryData, approvedBy) {
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      throw new Error('未找到员工');
    }

    const { newSalary, effectiveDate, reason } = salaryData;
    const previousSalary = employee.currentSalary;
    const adjustmentAmount = parseFloat(newSalary) - parseFloat(previousSalary);
    const adjustmentPercentage = ((adjustmentAmount / parseFloat(previousSalary)) * 100).toFixed(2);

    const adjustment = await SalaryAdjustment.create({
      employeeId,
      probationPlanId: planId,
      previousSalary,
      newSalary,
      adjustmentAmount,
      adjustmentPercentage,
      reason: reason || '试用期转正调薪',
      effectiveDate: effectiveDate || dayjs().format('YYYY-MM-DD'),
      status: SalaryAdjustmentStatus.APPROVED,
      approvedBy,
      approvedAt: new Date()
    });

    await SalaryEffectWorker.scheduleSalaryEffect(
      adjustment.id,
      employeeId,
      planId,
      adjustment.effectiveDate
    );

    return adjustment;
  }

  static async terminateProbation(planId, terminatedBy, reason) {
    const plan = await ProbationPlan.findByPk(planId);
    if (!plan) {
      throw new Error('未找到试用期计划');
    }

    const terminalStatuses = [ProbationStatus.CONFIRMED, ProbationStatus.TERMINATED];
    if (terminalStatuses.includes(plan.status)) {
      throw new Error(`试用期已处于终态 ${plan.status}，无法终止`);
    }

    const previousStatus = plan.status;
    plan.status = ProbationStatus.TERMINATED;
    await plan.save();

    await ProbationHistoryService.recordStatusChange(
      planId,
      plan.employeeId,
      previousStatus,
      ProbationStatus.TERMINATED,
      terminatedBy,
      'HR',
      `试用期已终止: ${reason}`
    );

    return plan;
  }
}

module.exports = ProbationService;
