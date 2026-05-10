const { Op } = require('sequelize');
const { 
  ReceiptAssignment, 
  VoidRecord,
  SegmentPool
} = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { 
  ReceiptNotExistsError, 
  ReceiptAlreadyVoidedError,
  ValidationError
} = require('../utils/errors');

class VoidService {
  async voidReceipt(data, operator = {}) {
    const {
      receipt_number,
      void_reason,
      is_recoverable = true,
      is_approval_required = false
    } = data;

    if (!receipt_number) {
      throw new ValidationError('请提供收据号');
    }

    if (!void_reason) {
      throw new ValidationError('请提供作废原因');
    }

    const assignment = await ReceiptAssignment.findOne({
      where: { receipt_number },
      include: [{
        model: SegmentPool,
        as: 'segmentPool'
      }]
    });

    if (!assignment) {
      throw new ReceiptNotExistsError(receipt_number);
    }

    if (assignment.status === 'voided') {
      throw new ReceiptAlreadyVoidedError(receipt_number);
    }

    const beforeData = { ...assignment.toJSON() };

    const voidTime = new Date();
    await assignment.update({
      status: 'voided',
      void_reason,
      void_time: voidTime
    });

    const voidRecord = await VoidRecord.create({
      receipt_assignment_id: assignment.id,
      receipt_number,
      numeric_number: assignment.numeric_number,
      void_reason,
      operator_id: operator.id,
      operator_name: operator.name,
      window_id: assignment.window_id,
      void_time: voidTime,
      is_recoverable,
      is_approval_required,
      approval_status: is_approval_required ? 'pending' : 'approved'
    });

    await createAuditLog({
      action: actions.VOID,
      actionDescription: `作废收据号「${receipt_number}」，原因：${void_reason}`,
      module: modules.VOID,
      receiptNumber: receipt_number,
      windowId: assignment.window_id,
      operatorId: operator.id,
      operatorName: operator.name,
      beforeData,
      afterData: assignment
    });

    logger.info(`作废收据成功: ${receipt_number}`);

    return {
      receipt_number,
      void_time: voidTime,
      is_recoverable,
      void_record_id: voidRecord.id
    };
  }

  async listVoidRecords(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      receipt_number,
      window_id,
      start_date,
      end_date,
      is_recoverable,
      is_recovered
    } = params;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (receipt_number) where.receipt_number = receipt_number;
    if (window_id) where.window_id = window_id;
    if (is_recoverable !== undefined) where.is_recoverable = is_recoverable;
    if (is_recovered !== undefined) where.is_recovered = is_recovered;

    if (start_date || end_date) {
      where.void_time = {};
      if (start_date) where.void_time[Op.gte] = start_date;
      if (end_date) where.void_time[Op.lte] = end_date;
    }

    const { count, rows } = await VoidRecord.findAndCountAll({
      where,
      order: [['void_time', 'DESC']],
      offset,
      limit: pageSize,
      include: [{
        model: ReceiptAssignment,
        as: 'assignment',
        attributes: ['business_id', 'business_type', 'amount']
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

  async getVoidRecordById(id) {
    const voidRecord = await VoidRecord.findByPk(id, {
      include: [{
        model: ReceiptAssignment,
        as: 'assignment'
      }]
    });

    if (!voidRecord) {
      throw new Error('作废记录不存在');
    }

    return voidRecord;
  }

  async getVoidStats(params = {}) {
    const { start_date, end_date, window_id } = params;
    const where = {};

    if (window_id) where.window_id = window_id;
    if (start_date || end_date) {
      where.void_time = {};
      if (start_date) where.void_time[Op.gte] = start_date;
      if (end_date) where.void_time[Op.lte] = end_date;
    }

    const totalVoided = await VoidRecord.count({ where });
    const recoverableCount = await VoidRecord.count({
      where: { ...where, is_recoverable: true }
    });
    const recoveredCount = await VoidRecord.count({
      where: { ...where, is_recoverable: true, is_recovered: true }
    });

    return {
      total_voided: totalVoided,
      recoverable_count: recoverableCount,
      recovered_count: recoveredCount,
      pending_recovery_count: recoverableCount - recoveredCount
    };
  }
}

module.exports = new VoidService();
