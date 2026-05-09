const LineStop = require('../models/LineStop');
const StatusHistory = require('../models/StatusHistory');
const { STATUS, STATUS_DESCRIPTIONS } = require('../utils/constants');
const { NotFoundError, StateTransitionError, ValidationError } = require('../utils/errors');
const StatusMachineService = require('./StatusMachineService');
const logger = require('../utils/logger');

class LineStopService {
  static async createLineStop(data) {
    try {
      const lineStop = await LineStop.create({
        lineCode: data.lineCode,
        lineName: data.lineName,
        stopTime: data.stopTime || new Date(),
        operator: data.operator,
        initialDescription: data.initialDescription,
        estimatedDuration: data.estimatedDuration,
        status: STATUS.CREATED
      });

      await StatusHistory.create({
        lineStopId: lineStop.id,
        fromStatus: null,
        toStatus: STATUS.CREATED,
        operator: data.operator,
        reason: '事件创建',
        metadata: JSON.stringify({
          lineCode: data.lineCode,
          stopTime: lineStop.stopTime
        })
      });

      logger.info('停线事件创建成功', { lineStopId: lineStop.id });
      return lineStop;
    } catch (error) {
      logger.error('创建停线事件失败', error);
      throw error;
    }
  }

  static async getLineStopById(id, includeAssociations = true) {
    const options = {
      where: { id },
      include: includeAssociations ? [
        { association: 'stopReasons', order: [['createdAt', 'DESC']] },
        { association: 'responsibilities', order: [['createdAt', 'DESC']] },
        { association: 'recoveryRecords', order: [['createdAt', 'DESC']] },
        { association: 'reviewReports', order: [['createdAt', 'DESC']] },
        { association: 'statusHistories', order: [['timestamp', 'ASC']] }
      ] : []
    };

    const lineStop = await LineStop.findOne(options);
    
    if (!lineStop) {
      throw new NotFoundError(`停线事件不存在: ${id}`);
    }

    return lineStop;
  }

  static async getLineStops(params = {}) {
    const { page = 1, limit = 20, status, lineCode, startDate, endDate } = params;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (status) where.status = status;
    if (lineCode) where.lineCode = lineCode;
    if (startDate || endDate) {
      where.stopTime = {};
      if (startDate) where.stopTime.$gte = new Date(startDate);
      if (endDate) where.stopTime.$lte = new Date(endDate);
    }

    const { count, rows } = await LineStop.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows
    };
  }

  static async updateStatus(lineStopId, toStatus, operator, reason = '', metadata = {}) {
    const lineStop = await this.getLineStopById(lineStopId, false);
    
    if (lineStop.status === toStatus) {
      return {
        lineStop,
        message: '状态未变化，已是目标状态'
      };
    }

    StatusMachineService.validateTransition(lineStop.status, toStatus);

    const fromStatus = lineStop.status;
    await lineStop.update({ status: toStatus });

    await StatusHistory.create({
      lineStopId,
      fromStatus,
      toStatus,
      operator,
      reason: reason || `从「${STATUS_DESCRIPTIONS[fromStatus]}」流转到「${STATUS_DESCRIPTIONS[toStatus]}」`,
      metadata: JSON.stringify(metadata)
    });

    StatusMachineService.logTransition(
      lineStopId,
      fromStatus,
      toStatus,
      operator,
      reason,
      metadata
    );

    return {
      lineStop,
      fromStatus,
      toStatus,
      message: `状态已从「${STATUS_DESCRIPTIONS[fromStatus]}」更新为「${STATUS_DESCRIPTIONS[toStatus]}」`
    };
  }

  static async getStatusHistory(lineStopId) {
    const history = await StatusHistory.findAll({
      where: { lineStopId },
      order: [['timestamp', 'ASC']]
    });

    return history.map(h => ({
      ...h.toJSON(),
      metadata: h.metadata ? JSON.parse(h.metadata) : null
    }));
  }

  static async getSummary(lineStopId) {
    const lineStop = await this.getLineStopById(lineStopId, true);
    
    const plainLineStop = lineStop.toJSON();
    
    const confirmedReasons = plainLineStop.stopReasons?.filter(
      r => r.status === 'CONFIRMED'
    ) || [];
    
    const activeResponsibility = plainLineStop.responsibilities?.find(
      r => r.status !== 'PENDING'
    ) || null;
    
    const latestRecovery = plainLineStop.recoveryRecords?.[0] || null;
    
    const approvedReport = plainLineStop.reviewReports?.find(
      r => r.status === 'APPROVED'
    ) || plainLineStop.reviewReports?.[0] || null;

    let actualDuration = null;
    if (plainLineStop.stopTime && latestRecovery?.endTime) {
      actualDuration = Math.round(
        (new Date(latestRecovery.endTime) - new Date(plainLineStop.stopTime)) / 60000
      );
    }

    return {
      lineStop: {
        id: plainLineStop.id,
        lineCode: plainLineStop.lineCode,
        lineName: plainLineStop.lineName,
        stopTime: plainLineStop.stopTime,
        status: plainLineStop.status,
        statusDescription: STATUS_DESCRIPTIONS[plainLineStop.status],
        estimatedDuration: plainLineStop.estimatedDuration,
        actualDuration: actualDuration || plainLineStop.actualDuration
      },
      reasons: {
        total: plainLineStop.stopReasons?.length || 0,
        confirmed: confirmedReasons.length,
        primaryReason: confirmedReasons.find(r => r.isPrimary) || confirmedReasons[0] || null,
        byCategory: this.groupReasonsByCategory(plainLineStop.stopReasons || [])
      },
      responsibility: activeResponsibility,
      recovery: latestRecovery,
      report: approvedReport,
      timeline: plainLineStop.statusHistories?.map(h => ({
        timestamp: h.timestamp,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        operator: h.operator,
        reason: h.reason
      })) || []
    };
  }

  static groupReasonsByCategory(reasons) {
    return reasons.reduce((acc, reason) => {
      const cat = reason.category;
      if (!acc[cat]) {
        acc[cat] = { count: 0, items: [] };
      }
      acc[cat].count++;
      acc[cat].items.push({
        id: reason.id,
        description: reason.description,
        status: reason.status,
        confidence: reason.confidence
      });
      return acc;
    }, {});
  }
}

module.exports = LineStopService;
