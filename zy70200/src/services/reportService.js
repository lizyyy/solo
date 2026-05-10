const { Op } = require('sequelize');
const dayjs = require('dayjs');
const {
  ProbationPlan,
  Employee,
  PerformanceEvaluation,
  MentorFeedback,
  SalaryAdjustment,
  ProbationHistory
} = require('../models');
const {
  ProbationStatus,
  EvaluationStatus,
  MentorFeedbackStatus,
  SalaryAdjustmentStatus,
  RuleCheckResult
} = require('../constants');
const ProbationRuleEngine = require('./probationRuleEngine');

class ReportService {
  static async getProbationDashboard() {
    const [
      totalPlans,
      pendingPlans,
      inProgressPlans,
      awaitingEvaluationPlans,
      evaluationCompletedPlans,
      awaitingApprovalPlans,
      approvedPlans,
      confirmedPlans,
      rejectedPlans,
      terminatedPlans,
      extensionRequestedPlans
    ] = await Promise.all([
      ProbationPlan.count(),
      ProbationPlan.count({ where: { status: ProbationStatus.PENDING } }),
      ProbationPlan.count({ where: { status: ProbationStatus.IN_PROGRESS } }),
      ProbationPlan.count({ where: { status: ProbationStatus.AWAITING_EVALUATION } }),
      ProbationPlan.count({ where: { status: ProbationStatus.EVALUATION_COMPLETED } }),
      ProbationPlan.count({ where: { status: ProbationStatus.AWAITING_APPROVAL } }),
      ProbationPlan.count({ where: { status: ProbationStatus.APPROVED } }),
      ProbationPlan.count({ where: { status: ProbationStatus.CONFIRMED } }),
      ProbationPlan.count({ where: { status: ProbationStatus.REJECTED } }),
      ProbationPlan.count({ where: { status: ProbationStatus.TERMINATED } }),
      ProbationPlan.count({ where: { status: ProbationStatus.EXTENSION_REQUESTED } })
    ]);

    const plansEndingSoon = await ProbationPlan.findAll({
      where: {
        status: {
          [Op.in]: [
            ProbationStatus.IN_PROGRESS,
            ProbationStatus.AWAITING_EVALUATION,
            ProbationStatus.EVALUATION_COMPLETED,
            ProbationStatus.AWAITING_APPROVAL
          ]
        },
        currentEndDate: {
          [Op.between]: [
            dayjs().format('YYYY-MM-DD'),
            dayjs().add(7, 'day').format('YYYY-MM-DD')
          ]
        }
      },
      include: [
        { model: Employee, as: 'employee' },
        { model: Employee, as: 'mentor' }
      ],
      order: [['currentEndDate', 'ASC']]
    });

    const extensionsUsed = await ProbationPlan.count({
      where: {
        extensionCount: { [Op.gt]: 0 }
      }
    });

    return {
      summary: {
        total: totalPlans,
        pending: pendingPlans,
        inProgress: inProgressPlans,
        awaitingEvaluation: awaitingEvaluationPlans,
        evaluationCompleted: evaluationCompletedPlans,
        awaitingApproval: awaitingApprovalPlans,
        approved: approvedPlans,
        confirmed: confirmedPlans,
        rejected: rejectedPlans,
        terminated: terminatedPlans,
        extensionRequested: extensionRequestedPlans
      },
      plansEndingSoon: plansEndingSoon.map(p => ({
        id: p.id,
        employeeId: p.employeeId,
        employeeName: p.employee?.name,
        mentorName: p.mentor?.name,
        currentEndDate: p.currentEndDate,
        status: p.status,
        daysRemaining: dayjs(p.currentEndDate).diff(dayjs(), 'day')
      })),
      statistics: {
        extensionsUsed,
        confirmationRate: totalPlans > 0 
          ? ((confirmedPlans / totalPlans) * 100).toFixed(2) 
          : 0
      }
    };
  }

  static async getPendingReviewsReport() {
    const pendingEvaluations = await PerformanceEvaluation.findAll({
      where: {
        status: {
          [Op.in]: [EvaluationStatus.PENDING, EvaluationStatus.SUBMITTED]
        }
      },
      include: [
        {
          model: ProbationPlan,
          as: 'probationPlan',
          include: [
            { model: Employee, as: 'employee' },
            { model: Employee, as: 'mentor' }
          ]
        },
        { model: Employee, as: 'evaluator' }
      ],
      order: [['submittedAt', 'DESC']]
    });

    const pendingMentorFeedbacks = await MentorFeedback.findAll({
      where: {
        status: MentorFeedbackStatus.PENDING
      },
      include: [
        {
          model: ProbationPlan,
          as: 'probationPlan',
          include: [
            { model: Employee, as: 'employee' }
          ]
        },
        { model: Employee, as: 'mentor' }
      ]
    });

    const plansAwaitingApproval = await ProbationPlan.findAll({
      where: {
        status: ProbationStatus.AWAITING_APPROVAL
      },
      include: [
        { model: Employee, as: 'employee' },
        { model: Employee, as: 'mentor' },
        { model: PerformanceEvaluation, as: 'evaluations' },
        { model: MentorFeedback, as: 'mentorFeedbacks' }
      ],
      order: [['updatedAt', 'DESC']]
    });

    const needsReviewPlans = [];
    for (const plan of plansAwaitingApproval) {
      const ruleCheck = ProbationRuleEngine.evaluateProbationReadiness(
        plan,
        plan.evaluations || [],
        plan.mentorFeedbacks || []
      );

      if (ruleCheck.overallResult !== RuleCheckResult.PASS) {
        needsReviewPlans.push({
          plan: {
            id: plan.id,
            employeeName: plan.employee?.name,
            mentorName: plan.mentor?.name,
            status: plan.status
          },
          ruleCheck,
          recommendedAction: ruleCheck.recommendedAction
        });
      }
    }

    return {
      pendingEvaluations: pendingEvaluations.map(e => ({
        id: e.id,
        status: e.status,
        submittedAt: e.submittedAt,
        employeeName: e.probationPlan?.employee?.name,
        evaluatorName: e.evaluator?.name,
        overallScore: e.overallScore
      })),
      pendingMentorFeedbacks: pendingMentorFeedbacks.map(f => ({
        id: f.id,
        employeeName: f.probationPlan?.employee?.name,
        mentorName: f.mentor?.name
      })),
      plansAwaitingApproval: plansAwaitingApproval.length,
      needsManualReview: needsReviewPlans
    };
  }

  static async getSalaryAdjustmentReport(startDate, endDate) {
    const where = {
      status: {
        [Op.in]: [SalaryAdjustmentStatus.APPROVED, SalaryAdjustmentStatus.EFFECTIVE]
      }
    };

    if (startDate) {
      where.createdAt = { [Op.gte]: dayjs(startDate).startOf('day').toDate() };
    }
    if (endDate) {
      if (!where.createdAt) where.createdAt = {};
      where.createdAt[Op.lte] = dayjs(endDate).endOf('day').toDate();
    }

    const adjustments = await SalaryAdjustment.findAll({
      where,
      include: [
        { model: Employee, as: 'employee' },
        { model: ProbationPlan, as: 'probationPlan' }
      ],
      order: [['effectiveDate', 'DESC']]
    });

    const totalAdjustments = adjustments.length;
    const effectiveAdjustments = adjustments.filter(a => a.status === SalaryAdjustmentStatus.EFFECTIVE).length;
    const pendingAdjustments = adjustments.filter(a => a.status === SalaryAdjustmentStatus.APPROVED).length;

    const totalAmount = adjustments.reduce((sum, a) => sum + parseFloat(a.adjustmentAmount), 0);
    const averagePercentage = totalAdjustments > 0
      ? adjustments.reduce((sum, a) => sum + parseFloat(a.adjustmentPercentage), 0) / totalAdjustments
      : 0;

    return {
      summary: {
        totalAdjustments,
        effectiveAdjustments,
        pendingAdjustments,
        totalAdjustmentAmount: totalAmount.toFixed(2),
        averageAdjustmentPercentage: averagePercentage.toFixed(2)
      },
      adjustments: adjustments.map(a => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee?.name,
        previousSalary: parseFloat(a.previousSalary),
        newSalary: parseFloat(a.newSalary),
        adjustmentAmount: parseFloat(a.adjustmentAmount),
        adjustmentPercentage: parseFloat(a.adjustmentPercentage),
        reason: a.reason,
        effectiveDate: a.effectiveDate,
        status: a.status,
        approvedAt: a.approvedAt,
        effectiveAt: a.effectiveAt
      }))
    };
  }

  static async getConfirmationHistoryReport(startDate, endDate) {
    const where = {
      status: {
        [Op.in]: [ProbationStatus.CONFIRMED, ProbationStatus.REJECTED, ProbationStatus.TERMINATED]
      }
    };

    if (startDate) {
      where.approvedAt = { [Op.gte]: dayjs(startDate).startOf('day').toDate() };
    }
    if (endDate) {
      if (!where.approvedAt) where.approvedAt = {};
      where.approvedAt[Op.lte] = dayjs(endDate).endOf('day').toDate();
    }

    const completedPlans = await ProbationPlan.findAll({
      where,
      include: [
        { model: Employee, as: 'employee' },
        { model: Employee, as: 'mentor' },
        { model: PerformanceEvaluation, as: 'evaluations' },
        { model: MentorFeedback, as: 'mentorFeedbacks' },
        { model: SalaryAdjustment, as: 'salaryAdjustments' }
      ],
      order: [['updatedAt', 'DESC']]
    });

    const confirmed = completedPlans.filter(p => p.status === ProbationStatus.CONFIRMED).length;
    const rejected = completedPlans.filter(p => p.status === ProbationStatus.REJECTED).length;
    const terminated = completedPlans.filter(p => p.status === ProbationStatus.TERMINATED).length;

    return {
      summary: {
        total: completedPlans.length,
        confirmed,
        rejected,
        terminated,
        confirmationRate: completedPlans.length > 0
          ? ((confirmed / completedPlans.length) * 100).toFixed(2)
          : 0
      },
      history: completedPlans.map(p => {
        const approvedEval = p.evaluations?.find(e => e.status === EvaluationStatus.APPROVED);
        const submittedFeedback = p.mentorFeedbacks?.find(f => f.status === MentorFeedbackStatus.SUBMITTED);
        const salaryAdjustment = p.salaryAdjustments?.[0];

        return {
          id: p.id,
          employeeId: p.employeeId,
          employeeName: p.employee?.name,
          employeeNo: p.employee?.employeeNo,
          department: p.employee?.department,
          position: p.employee?.position,
          mentorName: p.mentor?.name,
          startDate: p.startDate,
          originalEndDate: p.originalEndDate,
          currentEndDate: p.currentEndDate,
          durationMonths: p.durationMonths,
          extensionCount: p.extensionCount,
          status: p.status,
          performanceScore: approvedEval ? parseFloat(approvedEval.overallScore) : null,
          mentorScore: submittedFeedback ? parseFloat(submittedFeedback.overallScore) : null,
          mentorRecommendation: submittedFeedback?.recommendation,
          salaryAdjustment: salaryAdjustment ? {
            previousSalary: parseFloat(salaryAdjustment.previousSalary),
            newSalary: parseFloat(salaryAdjustment.newSalary),
            adjustmentAmount: parseFloat(salaryAdjustment.adjustmentAmount),
            adjustmentPercentage: parseFloat(salaryAdjustment.adjustmentPercentage)
          } : null,
          approvedAt: p.approvedAt,
          approvedBy: p.approvedBy
        };
      })
    };
  }

  static async getEmployeeAuditTrail(employeeId) {
    const histories = await ProbationHistory.findAll({
      where: { employeeId },
      include: [
        { model: ProbationPlan, as: 'probationPlan' }
      ],
      order: [['timestamp', 'DESC']]
    });

    return {
      employeeId,
      totalRecords: histories.length,
      auditTrail: histories.map(h => ({
        id: h.id,
        probationPlanId: h.probationPlanId,
        action: h.action,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        performedBy: h.performedBy,
        performedByRole: h.performedByRole,
        comment: h.comment,
        metadata: h.metadata,
        timestamp: h.timestamp
      }))
    };
  }

  static async getProbationAuditTrail(probationPlanId) {
    const histories = await ProbationHistory.findAll({
      where: { probationPlanId },
      include: [
        { model: Employee, as: 'employee' }
      ],
      order: [['timestamp', 'ASC']]
    });

    return {
      probationPlanId,
      totalRecords: histories.length,
      auditTrail: histories.map(h => ({
        id: h.id,
        action: h.action,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        performedBy: h.performedBy,
        performedByRole: h.performedByRole,
        comment: h.comment,
        metadata: h.metadata,
        timestamp: h.timestamp
      }))
    };
  }

  static getSystemRules() {
    return ProbationRuleEngine.getAllRules();
  }
}

module.exports = ReportService;
