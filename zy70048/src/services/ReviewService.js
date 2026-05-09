const ReviewReport = require('../models/ReviewReport');
const { STATUS, REPORT_STATUS } = require('../utils/constants');
const { NotFoundError, BusinessRuleError, ConflictError } = require('../utils/errors');
const LineStopService = require('./LineStopService');
const StatusMachineService = require('./StatusMachineService');
const logger = require('../utils/logger');

class ReviewService {
  static async createReport(lineStopId, data) {
    const lineStop = await LineStopService.getLineStopById(lineStopId, false);
    
    StatusMachineService.checkLineStopStatus(
      lineStop,
      [STATUS.RECOVERED, STATUS.REVIEWING],
      '创建复盘报告'
    );

    const existingDraft = await ReviewReport.findOne({
      where: {
        lineStopId,
        status: [REPORT_STATUS.DRAFT, REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_REVIEW]
      }
    });

    if (existingDraft) {
      throw new ConflictError(
        '已有未完成的复盘报告，请先完成或删除现有报告',
        { existingReportId: existingDraft.id }
      );
    }

    const report = await ReviewReport.create({
      lineStopId,
      summary: data.summary,
      rootCause: data.rootCause,
      impactAnalysis: data.impactAnalysis,
      correctiveActions: data.correctiveActions,
      preventiveActions: data.preventiveActions,
      learnedLessons: data.learnedLessons,
      preparedBy: data.preparedBy,
      preparedAt: data.preparedAt || new Date(),
      status: REPORT_STATUS.DRAFT
    });

    if (lineStop.status === STATUS.RECOVERED) {
      await LineStopService.updateStatus(
        lineStopId,
        STATUS.REVIEWING,
        data.preparedBy,
        '开始复盘'
      );
    }

    logger.info('复盘报告创建成功', {
      lineStopId,
      reportId: report.id,
      preparedBy: data.preparedBy
    });

    return report;
  }

  static async updateReport(reportId, data) {
    const report = await ReviewReport.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new NotFoundError(`复盘报告不存在: ${reportId}`);
    }

    if (report.status === REPORT_STATUS.APPROVED) {
      throw new BusinessRuleError(
        '已审批的报告不能修改，如需修改请创建新版本',
        { currentStatus: report.status }
      );
    }

    const updateData = {};
    const allowedFields = [
      'summary', 'rootCause', 'impactAnalysis',
      'correctiveActions', 'preventiveActions', 'learnedLessons'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    await report.update(updateData);

    logger.info('复盘报告已更新', {
      reportId,
      updates: Object.keys(updateData)
    });

    return report;
  }

  static async submitReport(reportId, operator) {
    const report = await ReviewReport.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new NotFoundError(`复盘报告不存在: ${reportId}`);
    }

    if (report.status === REPORT_STATUS.APPROVED) {
      return {
        report,
        message: '报告已审批，无需重复提交'
      };
    }

    if (report.status === REPORT_STATUS.SUBMITTED || 
        report.status === REPORT_STATUS.UNDER_REVIEW) {
      throw new ConflictError(
        '报告已在审批流程中',
        { currentStatus: report.status }
      );
    }

    await report.update({
      status: REPORT_STATUS.UNDER_REVIEW
    });

    logger.info('复盘报告已提交审批', {
      reportId,
      lineStopId: report.lineStopId,
      operator
    });

    return {
      report,
      message: '报告已提交，等待审批'
    };
  }

  static async approveReport(reportId, operator, comments = null) {
    const report = await ReviewReport.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new NotFoundError(`复盘报告不存在: ${reportId}`);
    }

    if (report.status === REPORT_STATUS.APPROVED) {
      return {
        report,
        message: '报告已审批'
      };
    }

    if (report.status !== REPORT_STATUS.UNDER_REVIEW) {
      throw new BusinessRuleError(
        '只有待审批的报告才能审批',
        { currentStatus: report.status }
      );
    }

    await report.update({
      status: REPORT_STATUS.APPROVED,
      approvedBy: operator,
      approvedAt: new Date(),
      reviewComments: comments
    });

    await LineStopService.updateStatus(
      report.lineStopId,
      STATUS.COMPLETED,
      operator,
      '复盘报告已审批，事件完成'
    );

    logger.info('复盘报告已审批', {
      reportId,
      lineStopId: report.lineStopId,
      operator
    });

    return {
      report,
      message: '复盘报告已审批，事件完成归档'
    };
  }

  static async rejectReport(reportId, operator, rejectReason) {
    const report = await ReviewReport.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new NotFoundError(`复盘报告不存在: ${reportId}`);
    }

    if (report.status !== REPORT_STATUS.UNDER_REVIEW) {
      throw new BusinessRuleError(
        '只有待审批的报告才能拒绝',
        { currentStatus: report.status }
      );
    }

    await report.update({
      status: REPORT_STATUS.REJECTED,
      reviewComments: rejectReason
    });

    logger.warn('复盘报告被拒绝', {
      reportId,
      lineStopId: report.lineStopId,
      operator,
      rejectReason
    });

    return {
      report,
      message: '报告已被拒绝，请修改后重新提交',
      suggestion: '修改报告内容后调用 updateReport 更新，然后再次 submitReport 提交'
    };
  }

  static async getReportsByLineStop(lineStopId) {
    return await ReviewReport.findAll({
      where: { lineStopId },
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = ReviewService;
