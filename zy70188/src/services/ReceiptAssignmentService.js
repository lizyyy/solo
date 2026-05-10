const { Op } = require('sequelize');
const { 
  SegmentPool, 
  ReceiptAssignment,
  RecoveredNumber,
  AuditLog
} = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { generateReceiptNumber, parseNumericNumber } = require('../utils/numberGenerator');
const { 
  SegmentExhaustedError, 
  ValidationError,
  ReceiptNotExistsError
} = require('../utils/errors');

class ReceiptAssignmentService {
  async assignReceipt(data, operator = {}) {
    const {
      window_id,
      window_name,
      business_id,
      business_type,
      amount
    } = data;

    if (!window_id) {
      throw new ValidationError('请提供收费窗口ID');
    }

    const segmentPool = await SegmentPool.findOne({
      where: { status: 'active' },
      order: [['created_at', 'ASC']]
    });

    if (!segmentPool) {
      throw new SegmentExhaustedError('当前没有可用的号段');
    }

    let result;
    const recoveredNumber = await this.getRecoveredNumber(segmentPool.id);
    
    if (recoveredNumber) {
      result = await this.assignFromRecovered(recoveredNumber, {
        window_id,
        window_name,
        operator_id: operator.id,
        operator_name: operator.name,
        business_id,
        business_type,
        amount
      });
    } else {
      result = await this.assignFromSegmentPool(segmentPool, {
        window_id,
        window_name,
        operator_id: operator.id,
        operator_name: operator.name,
        business_id,
        business_type,
        amount
      });
    }

    await createAuditLog({
      action: actions.ASSIGN,
      actionDescription: `窗口「${window_name || window_id}」分配收据号「${result.receipt_number}」`,
      module: modules.ASSIGNMENT,
      receiptNumber: result.receipt_number,
      windowId: window_id,
      operatorId: operator.id,
      operatorName: operator.name,
      afterData: result
    });

    logger.info(`分配收据号成功: ${result.receipt_number}, 窗口: ${window_id}`);
    return result;
  }

  async getRecoveredNumber(segmentPoolId) {
    return await RecoveredNumber.findOne({
      where: {
        segment_pool_id: segmentPoolId,
        is_used: false
      },
      order: [
        ['priority', 'DESC'],
        ['numeric_number', 'ASC']
      ]
    });
  }

  async assignFromRecovered(recoveredNumber, data) {
    await RecoveredNumber.update(
      {
        is_used: true,
        used_at: new Date(),
        used_by_window: data.window_id
      },
      {
        where: { id: recoveredNumber.id, is_used: false }
      }
    );

    const assignment = await ReceiptAssignment.create({
      receipt_number: recoveredNumber.receipt_number,
      numeric_number: recoveredNumber.numeric_number,
      segment_pool_id: recoveredNumber.segment_pool_id,
      window_id: data.window_id,
      window_name: data.window_name,
      operator_id: data.operator_id,
      operator_name: data.operator_name,
      business_id: data.business_id,
      business_type: data.business_type,
      amount: data.amount,
      status: 'recovered',
      used_at: new Date()
    });

    return {
      id: assignment.id,
      receipt_number: assignment.receipt_number,
      numeric_number: assignment.numeric_number,
      window_id: assignment.window_id,
      business_id: assignment.business_id,
      is_recovered: true
    };
  }

  async assignFromSegmentPool(segmentPool, data) {
    if (segmentPool.isExhausted()) {
      throw new SegmentExhaustedError(segmentPool.segment_code);
    }

    const nextNumber = segmentPool.current_number + 1;
    const receiptNumber = generateReceiptNumber(segmentPool, nextNumber);

    const [updatedCount] = await SegmentPool.update(
      {
        current_number: nextNumber,
        version: segmentPool.version + 1
      },
      {
        where: {
          id: segmentPool.id,
          version: segmentPool.version
        }
      }
    );

    if (updatedCount === 0) {
      throw new ValidationError('号段池更新失败，请重试');
    }

    if (nextNumber >= segmentPool.end_number) {
      await SegmentPool.update(
        { status: 'exhausted' },
        { where: { id: segmentPool.id } }
      );
    }

    const assignment = await ReceiptAssignment.create({
      receipt_number: receiptNumber,
      numeric_number: nextNumber,
      segment_pool_id: segmentPool.id,
      window_id: data.window_id,
      window_name: data.window_name,
      operator_id: data.operator_id,
      operator_name: data.operator_name,
      business_id: data.business_id,
      business_type: data.business_type,
      amount: data.amount,
      status: 'used',
      used_at: new Date()
    });

    return {
      id: assignment.id,
      receipt_number: assignment.receipt_number,
      numeric_number: assignment.numeric_number,
      window_id: assignment.window_id,
      business_id: assignment.business_id,
      is_recovered: false
    };
  }

  async listAssignments(params = {}) {
    const { 
      page = 1, 
      pageSize = 20, 
      window_id, 
      status, 
      receipt_number,
      start_date,
      end_date,
      business_id
    } = params;
    
    const offset = (page - 1) * pageSize;
    const where = {};

    if (window_id) where.window_id = window_id;
    if (status) where.status = status;
    if (receipt_number) where.receipt_number = receipt_number;
    if (business_id) where.business_id = business_id;

    if (start_date || end_date) {
      where.assigned_at = {};
      if (start_date) where.assigned_at[Op.gte] = start_date;
      if (end_date) where.assigned_at[Op.lte] = end_date;
    }

    const { count, rows } = await ReceiptAssignment.findAndCountAll({
      where,
      order: [['assigned_at', 'DESC']],
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

  async getAssignmentByReceiptNumber(receiptNumber) {
    const assignment = await ReceiptAssignment.findOne({
      where: { receipt_number: receiptNumber },
      include: [
        {
          model: SegmentPool,
          as: 'segmentPool',
          attributes: ['segment_code', 'segment_name', 'prefix', 'start_number', 'end_number']
        }
      ]
    });

    if (!assignment) {
      throw new ReceiptNotExistsError(receiptNumber);
    }

    return assignment;
  }

  async getAssignmentDetail(id) {
    const assignment = await ReceiptAssignment.findByPk(id, {
      include: [
        {
          model: SegmentPool,
          as: 'segmentPool',
          attributes: ['segment_code', 'segment_name']
        }
      ]
    });

    if (!assignment) {
      throw new ReceiptNotExistsError('收据记录不存在');
    }

    return assignment;
  }

  async batchAssign(count, data, operator = {}) {
    if (count <= 0 || count > 100) {
      throw new ValidationError('批量分配数量必须在1-100之间');
    }

    const results = [];
    for (let i = 0; i < count; i++) {
      const result = await this.assignReceipt(data, operator);
      results.push(result);
    }

    return {
      count: results.length,
      receipts: results
    };
  }

  async getWindowAssignmentStats(windowId, startDate, endDate) {
    const where = { window_id: windowId };
    
    if (startDate || endDate) {
      where.assigned_at = {};
      if (startDate) where.assigned_at[Op.gte] = startDate;
      if (endDate) where.assigned_at[Op.lte] = endDate;
    }

    const totalAssigned = await ReceiptAssignment.count({ where });
    const usedCount = await ReceiptAssignment.count({ 
      where: { ...where, status: 'used' } 
    });
    const voidedCount = await ReceiptAssignment.count({ 
      where: { ...where, status: 'voided' } 
    });
    const reprintedCount = await ReceiptAssignment.count({ 
      where: { ...where, status: 'reprinted' } 
    });
    const recoveredCount = await ReceiptAssignment.count({ 
      where: { ...where, status: 'recovered' } 
    });

    return {
      window_id: windowId,
      period_start: startDate,
      period_end: endDate,
      total_assigned: totalAssigned,
      used_count: usedCount,
      voided_count: voidedCount,
      reprinted_count: reprintedCount,
      recovered_count: recoveredCount
    };
  }
}

module.exports = new ReceiptAssignmentService();
