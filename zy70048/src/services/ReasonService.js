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

    const activeReasons = reasons.filter(r => 
      r.status === REASON_STATUS.PENDING || r.status === REASON_STATUS.CONFIRMED
    );
    
    const activeCategories = new Set(activeReasons.map(r => r.category));
    const conflicts = [];

    if (activeCategories.size > 1) {
      conflicts.push({
        type: 'CROSS_CATEGORY',
        categories: Array.from(activeCategories),
        reasons: activeReasons,
        message: `存在 ${activeCategories.size} 个类别的有效原因，存在冲突可能`,
        detail: '停线事件通常只有一个主要原因。不同类别的原因（设备/物料/人员）需要人工判断哪个是真正的根因，其他应标记为拒绝'
      });
    }

    Object.keys(categories).forEach(cat => {
      const catReasons = categories[cat];
      const pending = catReasons.filter(r => r.status === REASON_STATUS.PENDING);
      const confirmed = catReasons.filter(r => r.status === REASON_STATUS.CONFIRMED);
      
      if (pending.length > 1) {
        conflicts.push({
          type: 'INTRA_CATEGORY',
          category: cat,
          reasons: catReasons,
          message: `「${cat}」类别存在 ${pending.length} 条待确认记录`,
          detail: '同一类别下存在多个来源的待确认记录，需要选择主要原因'
        });
      }
      
      if (pending.length > 0 && confirmed.length > 0) {
        conflicts.push({
          type: 'INTRA_CATEGORY',
          category: cat,
          reasons: catReasons,
          message: `「${cat}」类别同时存在待确认和已确认记录`,
          detail: '同一类别下存在已确认记录，新的待确认记录需要与已确认记录协调'
        });
      }
    });

    let suggestion = '';
    if (conflicts.length === 0) {
      if (activeReasons.length === 0) {
        suggestion = '暂无有效原因记录，请先提交停线原因';
      } else {
        suggestion = '当前原因记录状态良好，可继续分配责任';
      }
    } else {
      suggestion = '请人工分析各来源记录的可信度，选择主要原因并将其他原因标记为拒绝';
    }

    return {
      totalReasons: reasons.length,
      activeReasons: activeReasons.length,
      categories: Object.keys(categories),
      activeCategories: Array.from(activeCategories),
      conflicts,
      hasConflicts: conflicts.length > 0,
      suggestion,
      conflictTypes: {
        crossCategory: conflicts.filter(c => c.type === 'CROSS_CATEGORY').length,
        intraCategory: conflicts.filter(c => c.type === 'INTRA_CATEGORY').length
      }
    };
  }
}

module.exports = ReasonService;
