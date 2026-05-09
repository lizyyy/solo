const StopReason = require('../models/StopReason');
const LineStop = require('../models/LineStop');
const { STATUS, REASON_STATUS } = require('../utils/constants');
const { NotFoundError, BusinessRuleError, ValidationError, ConflictError } = require('../utils/errors');
const LineStopService = require('./LineStopService');
const StatusMachineService = require('./StatusMachineService');
const logger = require('../utils/logger');

class ReasonService {
  static async submitReason(lineStopId, reasonData) {
    const lineStop = await LineStopService.getLineStopById(lineStopId, false);
    
    StatusMachineService.checkLineStopStatus(
      lineStop,
      [STATUS.CREATED, STATUS.REASON_ANALYZING],
      '提交停线原因'
    );

    const existingReason = await StopReason.findOne({
      where: {
        lineStopId,
        reporter: reasonData.reporter,
        source: reasonData.source,
        category: reasonData.category
      },
      order: [['createdAt', 'DESC']]
    });

    if (existingReason && existingReason.status === REASON_STATUS.PENDING) {
      throw new ConflictError(
        '该来源已有待确认的原因记录，请先处理现有记录',
        {
          existingReasonId: existingReason.id,
          message: '避免重复提交，每个来源每类原因只能有一个待确认记录'
        }
      );
    }

    const reason = await StopReason.create({
      lineStopId,
      category: reasonData.category,
      subCategory: reasonData.subCategory,
      source: reasonData.source,
      reporter: reasonData.reporter,
      description: reasonData.description,
      evidence: reasonData.evidence,
      timestamp: reasonData.timestamp || new Date(),
      confidence: reasonData.confidence || 0.5,
      status: REASON_STATUS.PENDING
    });

    if (lineStop.status === STATUS.CREATED) {
      await LineStopService.updateStatus(
        lineStopId,
        STATUS.REASON_ANALYZING,
        reasonData.reporter,
        '开始原因分析'
      );
    }

    logger.info('停线原因提交成功', {
      lineStopId,
      reasonId: reason.id,
      category: reason.category
    });

    return reason;
  }

  static async getReasonsByLineStop(lineStopId) {
    const reasons = await StopReason.findAll({
      where: { lineStopId },
      order: [['createdAt', 'DESC']]
    });

    return reasons;
  }

  static async confirmReason(reasonId, operator, isPrimary = false) {
    const reason = await StopReason.findOne({ where: { id: reasonId } });
    
    if (!reason) {
      throw new NotFoundError(`原因记录不存在: ${reasonId}`);
    }

    if (reason.status === REASON_STATUS.CONFIRMED) {
      return {
        reason,
        message: '该原因已确认，无需重复操作'
      };
    }

    if (reason.status === REASON_STATUS.REJECTED) {
      throw new BusinessRuleError(
        '已拒绝的原因不能再确认',
        { reasonId, currentStatus: reason.status }
      );
    }

    const lineStop = await LineStopService.getLineStopById(reason.lineStopId, false);
    
    if (!StatusMachineService.canConfirmReason(lineStop.status)) {
      throw new BusinessRuleError(
        '当前状态不允许确认原因',
        { lineStopStatus: lineStop.status }
      );
    }

    if (isPrimary) {
      await StopReason.update(
        { isPrimary: false },
        { where: { lineStopId: reason.lineStopId, isPrimary: true } }
      );
    }

    await reason.update({
      status: REASON_STATUS.CONFIRMED,
      isPrimary
    });

    const confirmedCount = await StopReason.count({
      where: {
        lineStopId: reason.lineStopId,
        status: REASON_STATUS.CONFIRMED
      }
    });

    if (confirmedCount >= 1 && lineStop.status === STATUS.REASON_ANALYZING) {
      await LineStopService.updateStatus(
        reason.lineStopId,
        STATUS.REASON_CONFIRMED,
        operator,
        '原因已确认，可分配责任'
      );
    }

    logger.info('停线原因已确认', {
      reasonId,
      lineStopId: reason.lineStopId,
      operator,
      isPrimary
    });

    return {
      reason,
      message: isPrimary ? '已设为主要原因并确认' : '原因已确认'
    };
  }

  static async rejectReason(reasonId, operator, rejectReason) {
    const reason = await StopReason.findOne({ where: { id: reasonId } });
    
    if (!reason) {
      throw new NotFoundError(`原因记录不存在: ${reasonId}`);
    }

    if (reason.status === REASON_STATUS.REJECTED) {
      return {
        reason,
        message: '该原因已被拒绝'
      };
    }

    if (reason.status === REASON_STATUS.CONFIRMED) {
      throw new BusinessRuleError(
        '已确认的原因不能再拒绝',
        { reasonId, currentStatus: reason.status }
      );
    }

    await reason.update({
      status: REASON_STATUS.REJECTED,
      rejectReason
    });

    logger.info('停线原因已拒绝', {
      reasonId,
      lineStopId: reason.lineStopId,
      operator
    });

    return {
      reason,
      message: '原因已拒绝'
    };
  }

  static async getConflictingReasons(lineStopId) {
    const reasons = await this.getReasonsByLineStop(lineStopId);
    
    const categories = {};
    reasons.forEach(r => {
      if (!categories[r.category]) {
        categories[r.category] = [];
      }
      categories[r.category].push(r);
    });

    const conflicts = [];
    Object.keys(categories).forEach(cat => {
      const catReasons = categories[cat];
      if (catReasons.length > 1) {
        const pending = catReasons.filter(r => r.status === REASON_STATUS.PENDING);
        const confirmed = catReasons.filter(r => r.status === REASON_STATUS.CONFIRMED);
        
        if (pending.length > 1 || (pending.length > 0 && confirmed.length > 0)) {
          conflicts.push({
            category: cat,
            reasons: catReasons,
            message: `该类别存在 ${catReasons.length} 条记录，存在冲突可能`
          });
        }
      }
    });

    return {
      totalReasons: reasons.length,
      categories: Object.keys(categories),
      conflicts,
      suggestion: conflicts.length > 0 
        ? '建议确认各来源记录，选择主要原因并拒绝冲突记录'
        : '当前原因记录无明显冲突'
    };
  }
}

module.exports = ReasonService;
