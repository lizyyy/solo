const { Op } = require('sequelize');
const { 
  SegmentPool, 
  ReceiptAssignment,
  VoidRecord,
  GapDetection,
  AuditLog
} = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { ResourceNotFoundError } = require('../utils/errors');

class GapDetectionService {
  async detectGaps(segmentPoolId, operator = {}) {
    const segmentPool = await SegmentPool.findByPk(segmentPoolId);
    if (!segmentPool) {
      throw new ResourceNotFoundError('号段池不存在');
    }

    const startNum = segmentPool.start_number;
    const endNum = segmentPool.current_number;

    if (endNum <= startNum) {
      return {
        detected: false,
        message: '号段池尚未开始使用，无需检测',
        gaps: []
      };
    }

    const usedNumbers = await ReceiptAssignment.findAll({
      where: {
        segment_pool_id: segmentPoolId,
        numeric_number: {
          [Op.between]: [startNum, endNum]
        }
      },
      attributes: ['numeric_number', 'status', 'receipt_number'],
      order: [['numeric_number', 'ASC']]
    });

    const usedNumberSet = new Set(
      usedNumbers.map(n => n.numeric_number)
    );

    const gaps = [];
    let currentGapStart = null;

    for (let num = startNum; num <= endNum; num++) {
      if (!usedNumberSet.has(num)) {
        if (currentGapStart === null) {
          currentGapStart = num;
        }
      } else if (currentGapStart !== null) {
        const gapEnd = num - 1;
        const gapCount = gapEnd - currentGapStart + 1;
        
        const gapDetails = await this.checkGapDetails(segmentPoolId, currentGapStart, gapEnd);
        
        gaps.push({
          gap_start_number: currentGapStart,
          gap_end_number: gapEnd,
          gap_count: gapCount,
          ...gapDetails
        });
        
        currentGapStart = null;
      }
    }

    if (currentGapStart !== null) {
      const gapEnd = endNum;
      const gapCount = gapEnd - currentGapStart + 1;
      
      const gapDetails = await this.checkGapDetails(segmentPoolId, currentGapStart, gapEnd);
      
      gaps.push({
        gap_start_number: currentGapStart,
        gap_end_number: gapEnd,
        gap_count: gapCount,
        ...gapDetails
      });
    }

    for (const gap of gaps) {
      await GapDetection.create({
        segment_pool_id: segmentPoolId,
        gap_start_number: gap.gap_start_number,
        gap_end_number: gap.gap_end_number,
        gap_count: gap.gap_count,
        detected_by: operator.id || 'system',
        status: gap.is_known ? 'resolved' : 'detected',
        resolution_type: gap.resolution_type
      });
    }

    await createAuditLog({
      action: actions.CHECK_GAP,
      actionDescription: `检测号段「${segmentPool.segment_name}」(${segmentPool.segment_code})断号，发现 ${gaps.length} 处断号`,
      module: modules.REPORT,
      operatorId: operator.id,
      operatorName: operator.name,
      afterData: { gap_count: gaps.length }
    });

    logger.info(`断号检测完成: 号段 ${segmentPool.segment_code}，发现 ${gaps.length} 处断号`);

    return {
      detected: gaps.length > 0,
      message: `检测完成，发现 ${gaps.length} 处断号`,
      gap_count: gaps.length,
      gaps: gaps,
      total_gap_numbers: gaps.reduce((sum, g) => sum + g.gap_count, 0)
    };
  }

  async checkGapDetails(segmentPoolId, gapStart, gapEnd) {
    const voidRecords = await VoidRecord.findAll({
      where: {
        numeric_number: {
          [Op.between]: [gapStart, gapEnd]
        }
      }
    });

    const voidedNumbers = new Set(voidRecords.map(v => v.numeric_number));
    
    let allVoided = true;
    for (let num = gapStart; num <= gapEnd; num++) {
      if (!voidedNumbers.has(num)) {
        allVoided = false;
        break;
      }
    }

    if (allVoided) {
      return {
        is_known: true,
        resolution_type: 'voided',
        status: '已确认作废',
        notes: '所有断号号码均为已作废收据'
      };
    }

    return {
      is_known: false,
      resolution_type: null,
      status: '待调查',
      notes: '存在未确认的断号，需要人工核实'
    };
  }

  async listGapDetections(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      segment_pool_id,
      status,
      start_date,
      end_date
    } = params;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (segment_pool_id) where.segment_pool_id = segment_pool_id;
    if (status) where.status = status;

    if (start_date || end_date) {
      where.detected_at = {};
      if (start_date) where.detected_at[Op.gte] = start_date;
      if (end_date) where.detected_at[Op.lte] = end_date;
    }

    const { count, rows } = await GapDetection.findAndCountAll({
      where,
      order: [['detected_at', 'DESC']],
      offset,
      limit: pageSize,
      include: [{
        model: SegmentPool,
        as: 'segmentPool',
        attributes: ['segment_code', 'segment_name']
      }]
    });

    return {
      list: rows.map(r => r.toJSON()),
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    };
  }

  async resolveGap(id, data, operator = {}) {
    const gapDetection = await GapDetection.findByPk(id);
    if (!gapDetection) {
      throw new ResourceNotFoundError('断号检测记录不存在');
    }

    await gapDetection.update({
      status: 'resolved',
      resolution_type: data.resolution_type,
      resolved_at: new Date(),
      resolved_by: operator.id,
      resolution_notes: data.resolution_notes
    });

    logger.info(`断号已处理: ${id}`);

    return gapDetection;
  }

  async ignoreGap(id, notes, operator = {}) {
    const gapDetection = await GapDetection.findByPk(id);
    if (!gapDetection) {
      throw new ResourceNotFoundError('断号检测记录不存在');
    }

    await gapDetection.update({
      status: 'ignored',
      resolved_at: new Date(),
      resolved_by: operator.id,
      resolution_notes: notes || '忽略此断号'
    });

    return gapDetection;
  }

  async getGapStats() {
    const totalDetected = await GapDetection.count();
    const resolvedCount = await GapDetection.count({ where: { status: 'resolved' } });
    const investigatingCount = await GapDetection.count({ where: { status: 'investigating' } });
    const ignoredCount = await GapDetection.count({ where: { status: 'ignored' } });
    const detectedCount = await GapDetection.count({ where: { status: 'detected' } });

    return {
      total_detected: totalDetected,
      resolved: resolvedCount,
      investigating: investigatingCount,
      ignored: ignoredCount,
      pending: detectedCount
    };
  }
}

module.exports = new GapDetectionService();
