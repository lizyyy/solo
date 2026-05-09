const db = require('../config/database');
const QuotaModel = require('../models/QuotaModel');
const ApprovalRecordModel = require('../models/ApprovalRecordModel');
const QuotaOperationModel = require('../models/QuotaOperationModel');
const AuditLogModel = require('../models/AuditLogModel');
const logger = require('../utils/logger');

class StatisticsService {
  static async getQuotaSummary() {
    const quotaStats = await QuotaModel.getStatistics();
    const approvalStats = await ApprovalRecordModel.getStatistics();
    const operationStats = await QuotaOperationModel.getStatistics();

    const statusSummary = {};
    approvalStats.forEach(item => {
      statusSummary[item.status] = {
        count: parseInt(item.count),
        totalAmount: parseFloat(item.total_amount),
      };
    });

    const operationSummary = {};
    operationStats.forEach(item => {
      operationSummary[item.operation_type] = {
        count: parseInt(item.count),
        totalAmount: parseFloat(item.total_amount),
      };
    });

    return {
      quotaSummary: {
        totalQuotas: parseInt(quotaStats.total_quotas) || 0,
        totalAmount: parseFloat(quotaStats.total_amount) || 0,
        usedAmount: parseFloat(quotaStats.total_used) || 0,
        occupiedAmount: parseFloat(quotaStats.total_occupied) || 0,
        availableAmount: parseFloat(quotaStats.total_available) || 0,
      },
      approvalSummary: statusSummary,
      operationSummary,
    };
  }

  static async verifyConsistency() {
    const result = await db.transaction(async (client) => {
      const quotaStats = await client.query(`
        SELECT 
          SUM(total_amount) as total_amount,
          SUM(used_amount) as total_used,
          SUM(occupied_amount) as total_occupied,
          SUM(available_amount) as total_available
        FROM quotas
      `);

      const operationStats = await client.query(`
        SELECT 
          operation_type,
          SUM(amount) as total_amount
        FROM quota_operations
        GROUP BY operation_type
      `);

      const approvalStats = await client.query(`
        SELECT 
          status,
          SUM(apply_amount) as total_amount
        FROM approval_records
        GROUP BY status
      `);

      const quota = quotaStats.rows[0];
      const operations = {};
      operationStats.rows.forEach(r => {
        operations[r.operation_type] = parseFloat(r.total_amount) || 0;
      });
      const approvals = {};
      approvalStats.rows.forEach(r => {
        approvals[r.status] = parseFloat(r.total_amount) || 0;
      });

      const totalOccupy = operations.occupy || 0;
      const totalRelease = operations.release || 0;
      const totalDeduct = operations.deduct || 0;

      const expectedUsed = totalDeduct;
      const expectedOccupied = totalOccupy - totalRelease - totalDeduct;

      const inconsistencies = [];

      const quotaUsed = parseFloat(quota.total_used) || 0;
      const quotaOccupied = parseFloat(quota.total_occupied) || 0;

      if (Math.abs(quotaUsed - expectedUsed) > 0.01) {
        inconsistencies.push({
          type: 'USED_AMOUNT_MISMATCH',
          description: '已使用金额与操作记录不一致',
          quotaValue: quotaUsed,
          expectedValue: expectedUsed,
        });
      }

      if (Math.abs(quotaOccupied - expectedOccupied) > 0.01) {
        inconsistencies.push({
          type: 'OCCUPIED_AMOUNT_MISMATCH',
          description: '占用金额与操作记录不一致',
          quotaValue: quotaOccupied,
          expectedValue: expectedOccupied,
        });
      }

      return {
        consistent: inconsistencies.length === 0,
        inconsistencies,
        verificationData: {
          quota: {
            used: quotaUsed,
            occupied: quotaOccupied,
          },
          operations: {
            occupy: totalOccupy,
            release: totalRelease,
            deduct: totalDeduct,
            expectedUsed,
            expectedOccupied,
          },
          approvals,
        },
      };
    });

    return result;
  }

  static async getAuditLogs(limit = 100) {
    return await AuditLogModel.getRecent(limit);
  }

  static async getQuotaOperations(quotaCode, limit = 100) {
    const quota = await QuotaModel.findByCode(quotaCode);
    if (!quota) {
      return [];
    }
    return await QuotaOperationModel.getQuotaOperations(quota.id, limit);
  }
}

module.exports = StatisticsService;
