const { Op } = require('sequelize');
const { 
  VoidRecord, 
  RecoveredNumber,
  ReceiptAssignment
} = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { ValidationError } = require('../utils/errors');

class RecoverService {
  async recoverVoidedReceipts(params = {}, operator = {}) {
    const {
      receipt_numbers,
      segment_pool_id,
      all_recoverable = false,
      priority = 0,
      batch_size = 100
    } = params;

    let voidRecords = [];

    if (all_recoverable) {
      voidRecords = await VoidRecord.findAll({
        where: {
          is_recoverable: true,
          is_recovered: false,
          approval_status: 'approved'
        },
        limit: batch_size
      });
    } else if (receipt_numbers && receipt_numbers.length > 0) {
      voidRecords = await VoidRecord.findAll({
        where: {
          receipt_number: { [Op.in]: receipt_numbers },
          is_recoverable: true,
          is_recovered: false
        }
      });
    } else {
      throw new ValidationError('请指定要回收的收据号或选择回收所有可回收收据');
    }

    if (voidRecords.length === 0) {
      return {
        recovered_count: 0,
        failed_count: 0,
        failed_receipts: [],
        message: '没有可回收的作废收据'
      };
    }

    const recovered = [];
    const failed = [];

    for (const voidRecord of voidRecords) {
      try {
        const recoveredNumber = await RecoveredNumber.create({
          receipt_number: voidRecord.receipt_number,
          numeric_number: voidRecord.numeric_number,
          segment_pool_id: segment_pool_id || (await this.getAssignmentSegmentPoolId(voidRecord.receipt_assignment_id)),
          original_window_id: voidRecord.window_id,
          void_record_id: voidRecord.id,
          priority
        });

        await voidRecord.update({
          is_recovered: true,
          recovered_at: new Date(),
          recovered_by: operator.id
        });

        recovered.push(voidRecord.receipt_number);

        await createAuditLog({
          action: actions.RECOVER,
          actionDescription: `回收作废收据「${voidRecord.receipt_number}」至号码池`,
          module: modules.ASSIGNMENT,
          receiptNumber: voidRecord.receipt_number,
          windowId: voidRecord.window_id,
          operatorId: operator.id,
          operatorName: operator.name
        });

        logger.info(`回收收据成功: ${voidRecord.receipt_number}`);
      } catch (error) {
        failed.push({
          receipt_number: voidRecord.receipt_number,
          error: error.message
        });
        logger.error(`回收收据失败: ${voidRecord.receipt_number}`, error);
      }
    }

    return {
      recovered_count: recovered.length,
      failed_count: failed.length,
      recovered_receipts: recovered,
      failed_receipts: failed,
      message: `成功回收 ${recovered.length} 个收据号`
    };
  }

  async getAssignmentSegmentPoolId(assignmentId) {
    const assignment = await ReceiptAssignment.findByPk(assignmentId);
    return assignment ? assignment.segment_pool_id : null;
  }

  async listRecoveredNumbers(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      segment_pool_id,
      is_used,
      receipt_number
    } = params;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (segment_pool_id) where.segment_pool_id = segment_pool_id;
    if (is_used !== undefined) where.is_used = is_used;
    if (receipt_number) where.receipt_number = receipt_number;

    const { count, rows } = await RecoveredNumber.findAndCountAll({
      where,
      order: [
        ['priority', 'DESC'],
        ['numeric_number', 'ASC']
      ],
      offset,
      limit: pageSize
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

  async getRecoverStats() {
    const totalRecovered = await RecoveredNumber.count();
    const usedRecovered = await RecoveredNumber.count({ where: { is_used: true } });
    const availableRecovered = await RecoveredNumber.count({ where: { is_used: false } });

    return {
      total_recovered: totalRecovered,
      used_recovered: usedRecovered,
      available_recovered: availableRecovered
    };
  }
}

module.exports = new RecoverService();
