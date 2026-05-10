const { Op } = require('sequelize');
const { 
  ReceiptAssignment, 
  ReprintRecord,
  SegmentPool
} = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { 
  ReceiptNotExistsError, 
  ReceiptAlreadyVoidedError,
  ValidationError
} = require('../utils/errors');

class ReprintService {
  async reprintReceipt(data, operator = {}) {
    const {
      receipt_number,
      reprint_reason,
      window_id,
      is_approval_required = false
    } = data;

    if (!receipt_number) {
      throw new ValidationError('请提供收据号');
    }

    if (!reprint_reason) {
      throw new ValidationError('请提供补打原因');
    }

    if (!window_id) {
      throw new ValidationError('请提供补打窗口ID');
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

    const existingReprints = await ReprintRecord.count({
      where: { receipt_assignment_id: assignment.id }
    });

    const beforeData = { ...assignment.toJSON() };

    await assignment.update({
      status: 'reprinted'
    });

    const reprintRecord = await ReprintRecord.create({
      receipt_assignment_id: assignment.id,
      receipt_number,
      reprint_count: existingReprints + 1,
      reprint_reason,
      original_operator_id: assignment.operator_id,
      reprint_operator_id: operator.id,
      reprint_operator_name: operator.name,
      window_id,
      is_approval_required,
      approval_status: is_approval_required ? 'pending' : 'approved'
    });

    await createAuditLog({
      action: actions.REPRINT,
      actionDescription: `补打收据号「${receipt_number}」，原因：${reprint_reason}，补打次数：第${existingReprints + 1}次`,
      module: modules.REPRINT,
      receiptNumber: receipt_number,
      windowId: window_id,
      operatorId: operator.id,
      operatorName: operator.name,
      beforeData,
      afterData: { ...assignment.toJSON(), reprint_count: existingReprints + 1 }
    });

    logger.info(`补打收据成功: ${receipt_number}, 补打次数: ${existingReprints + 1}`);

    return {
      receipt_number,
      reprint_count: existingReprints + 1,
      reprint_time: reprintRecord.reprint_time,
      original_operator: assignment.operator_name,
      reprint_operator: operator.name
    };
  }

  async listReprintRecords(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      receipt_number,
      window_id,
      reprint_operator_id,
      start_date,
      end_date
    } = params;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (receipt_number) where.receipt_number = receipt_number;
    if (window_id) where.window_id = window_id;
    if (reprint_operator_id) where.reprint_operator_id = reprint_operator_id;

    if (start_date || end_date) {
      where.reprint_time = {};
      if (start_date) where.reprint_time[Op.gte] = start_date;
      if (end_date) where.reprint_time[Op.lte] = end_date;
    }

    const { count, rows } = await ReprintRecord.findAndCountAll({
      where,
      order: [['reprint_time', 'DESC']],
      offset,
      limit: pageSize,
      include: [{
        model: ReceiptAssignment,
        as: 'assignment',
        attributes: ['business_id', 'business_type', 'amount', 'operator_name', 'window_name']
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

  async getReprintRecordsByReceiptNumber(receiptNumber) {
    const records = await ReprintRecord.findAll({
      where: { receipt_number: receiptNumber },
      order: [['reprint_time', 'ASC']]
    });

    return {
      receipt_number: receiptNumber,
      total_reprints: records.length,
      records: records.map(r => r.toJSON())
    };
  }

  async getReprintStats(params = {}) {
    const { start_date, end_date, window_id } = params;
    const where = {};

    if (window_id) where.window_id = window_id;
    if (start_date || end_date) {
      where.reprint_time = {};
      if (start_date) where.reprint_time[Op.gte] = start_date;
      if (end_date) where.reprint_time[Op.lte] = end_date;
    }

    const records = await ReprintRecord.findAll({
      where,
      attributes: ['reprint_count']
    });

    let totalReprints = 0;
    const uniqueReceipts = new Set();

    records.forEach(record => {
      totalReprints += record.reprint_count;
    });

    const uniqueReceiptCount = await ReprintRecord.count({
      where,
      distinct: true,
      col: 'receipt_number'
    });

    return {
      total_reprints: totalReprints,
      unique_receipts: uniqueReceiptCount,
      average_reprints_per_receipt: uniqueReceiptCount > 0 
        ? (totalReprints / uniqueReceiptCount).toFixed(2) 
        : 0
    };
  }
}

module.exports = new ReprintService();
