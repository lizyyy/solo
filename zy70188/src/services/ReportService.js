const { Op } = require('sequelize');
const moment = require('moment');
const ExcelJS = require('exceljs');
const { 
  SegmentPool, 
  ReceiptAssignment,
  VoidRecord,
  ReprintRecord,
  GapDetection,
  AuditLog
} = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { ValidationError } = require('../utils/errors');

class ReportService {
  async getDailyReport(params = {}) {
    const {
      start_date,
      end_date,
      window_id
    } = params;

    if (!start_date || !end_date) {
      throw new ValidationError('请提供统计起止日期');
    }

    const where = {
      assigned_at: {
        [Op.between]: [start_date, end_date]
      }
    };

    if (window_id) {
      where.window_id = window_id;
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

    const totalVoidAmount = await ReceiptAssignment.sum('amount', {
      where: { ...where, status: 'voided' }
    });

    const totalUsedAmount = await ReceiptAssignment.sum('amount', {
      where: { ...where, status: { [Op.in]: ['used', 'reprinted', 'recovered'] } }
    });

    const voidRecords = await VoidRecord.count({
      where: {
        void_time: { [Op.between]: [start_date, end_date] },
        ...(window_id ? { window_id } : {})
      }
    });

    const reprintRecords = await ReprintRecord.count({
      where: {
        reprint_time: { [Op.between]: [start_date, end_date] },
        ...(window_id ? { window_id } : {})
      }
    });

    const segmentStats = await this.getSegmentUsageStats(start_date, end_date);

    return {
      period_start: start_date,
      period_end: end_date,
      summary: {
        total_assigned: totalAssigned,
        used_count: usedCount,
        voided_count: voidedCount,
        reprinted_count: reprintedCount,
        recovered_count: recoveredCount,
        void_rate: totalAssigned > 0 ? ((voidedCount / totalAssigned) * 100).toFixed(2) : 0,
        used_amount: totalUsedAmount || 0,
        voided_amount: totalVoidAmount || 0
      },
      operations: {
        void_records: voidRecords,
        reprint_records: reprintRecords
      },
      segment_usage: segmentStats
    };
  }

  async getSegmentUsageStats(startDate, endDate) {
    const segments = await SegmentPool.findAll();
    const stats = [];

    for (const segment of segments) {
      const assigned = await ReceiptAssignment.count({
        where: {
          segment_pool_id: segment.id,
          assigned_at: { [Op.between]: [startDate, endDate] }
        }
      });

      stats.push({
        segment_code: segment.segment_code,
        segment_name: segment.segment_name,
        total_range: segment.end_number - segment.start_number + 1,
        used_in_period: assigned,
        current_progress: segment.current_number - segment.start_number + 1,
        remaining: segment.end_number - segment.current_number,
        status: segment.status
      });
    }

    return stats;
  }

  async getWindowReport(params = {}) {
    const { start_date, end_date } = params;
    
    const assignments = await ReceiptAssignment.findAll({
      where: {
        assigned_at: { [Op.between]: [start_date, end_date] }
      },
      attributes: [
        'window_id',
        'window_name',
        [
          ReceiptAssignment.sequelize.fn('COUNT', ReceiptAssignment.sequelize.col('id')),
          'total'
        ]
      ],
      group: ['window_id', 'window_name'],
      order: [[ReceiptAssignment.sequelize.col('total'), 'DESC']]
    });

    const windowStats = [];
    for (const item of assignments) {
      const windowId = item.window_id;
      
      const used = await ReceiptAssignment.count({
        where: {
          window_id: windowId,
          status: 'used',
          assigned_at: { [Op.between]: [start_date, end_date] }
        }
      });
      
      const voided = await ReceiptAssignment.count({
        where: {
          window_id: windowId,
          status: 'voided',
          assigned_at: { [Op.between]: [start_date, end_date] }
        }
      });

      const reprinted = await ReceiptAssignment.count({
        where: {
          window_id: windowId,
          status: 'reprinted',
          assigned_at: { [Op.between]: [start_date, end_date] }
        }
      });

      windowStats.push({
        window_id: windowId,
        window_name: item.window_name || windowId,
        total_assigned: item.dataValues.total,
        used,
        voided,
        reprinted,
        void_rate: item.dataValues.total > 0 
          ? ((voided / item.dataValues.total) * 100).toFixed(2)
          : 0
      });
    }

    return {
      period_start: start_date,
      period_end: end_date,
      windows: windowStats
    };
  }

  async exportToExcel(reportType, params = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('报表');

    let data;
    let headers;

    if (reportType === 'daily') {
      data = await this.getDailyReport(params);
      headers = [
        { header: '项目', key: 'item' },
        { header: '数值', key: 'value' }
      ];
    } else if (reportType === 'window') {
      data = await this.getWindowReport(params);
      headers = [
        { header: '窗口ID', key: 'window_id' },
        { header: '窗口名称', key: 'window_name' },
        { header: '总分配', key: 'total_assigned' },
        { header: '正常使用', key: 'used' },
        { header: '已作废', key: 'voided' },
        { header: '已补打', key: 'reprinted' },
        { header: '作废率(%)', key: 'void_rate' }
      ];
    } else {
      throw new ValidationError('不支持的报表类型');
    }

    worksheet.columns = headers;

    if (reportType === 'daily') {
      const rows = [
        { item: '统计开始日期', value: params.start_date },
        { item: '统计结束日期', value: params.end_date },
        { item: '总分配数量', value: data.summary.total_assigned },
        { item: '正常使用数量', value: data.summary.used_count },
        { item: '已作废数量', value: data.summary.voided_count },
        { item: '已补打数量', value: data.summary.reprinted_count },
        { item: '已回收复用数量', value: data.summary.recovered_count },
        { item: '作废率(%)', value: data.summary.void_rate },
        { item: '使用金额(元)', value: data.summary.used_amount },
        { item: '作废金额(元)', value: data.summary.voided_amount }
      ];
      worksheet.addRows(rows);
    } else if (reportType === 'window') {
      worksheet.addRows(data.windows);
    }

    const filePath = `报表_${moment().format('YYYYMMDD_HHmmss')}.xlsx`;
    await workbook.xlsx.writeFile(filePath);

    await createAuditLog({
      action: actions.EXPORT,
      actionDescription: `导出${reportType === 'daily' ? '日报表' : '窗口报表'}`,
      module: modules.REPORT,
      afterData: { reportType, params }
    });

    logger.info(`导出报表成功: ${filePath}`);

    return filePath;
  }

  async getAuditTrail(receiptNumber) {
    const logs = await AuditLog.findAll({
      where: {
        receipt_number: receiptNumber
      },
      order: [['log_time', 'ASC']]
    });

    const assignment = await ReceiptAssignment.findOne({
      where: { receipt_number: receiptNumber }
    });

    const voidRecord = await VoidRecord.findOne({
      where: { receipt_number: receiptNumber }
    });

    const reprintRecords = await ReprintRecord.findAll({
      where: { receipt_number: receiptNumber }
    });

    return {
      receipt_number: receiptNumber,
      basic_info: assignment ? assignment.toJSON() : null,
      void_record: voidRecord ? voidRecord.toJSON() : null,
      reprint_records: reprintRecords.map(r => r.toJSON()),
      audit_logs: logs.map(l => ({
        action: l.action,
        description: l.action_description,
        operator: l.operator_name,
        time: l.log_time,
        result: l.result
      }))
    };
  }
}

module.exports = new ReportService();
