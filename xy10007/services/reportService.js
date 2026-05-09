const ExcelJS = require('exceljs');
const { Refund, AuditLog } = require('../models');
const { Op } = require('sequelize');

class ReportService {
  static async generateRefundReport(options = {}) {
    const { startDate, endDate, status } = options;
    const where = {};

    if (startDate) where.createdAt = { ...where.createdAt, [Op.gte]: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, [Op.lte]: new Date(endDate) };
    if (status) where.status = status;

    const refunds = await Refund.findAll({
      where,
      include: [{ model: require('../models/Order'), as: 'order' }],
      order: [['createdAt', 'DESC']]
    });

    return refunds;
  }

  static async exportToExcel(refunds) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Refunds');

    sheet.columns = [
      { header: '退款单号', key: 'refundNo', width: 20 },
      { header: '订单号', key: 'orderNo', width: 20 },
      { header: '用户ID', key: 'userId', width: 15 },
      { header: '退款金额', key: 'amount', width: 15 },
      { header: '退款原因', key: 'reason', width: 30 },
      { header: '状态', key: 'status', width: 15 },
      { header: '审核意见', key: 'reviewComment', width: 30 },
      { header: '操作人', key: 'operatorId', width: 15 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '更新时间', key: 'updatedAt', width: 20 }
    ];

    refunds.forEach(refund => {
      sheet.addRow({
        refundNo: refund.refundNo,
        orderNo: refund.order?.orderNo || '-',
        userId: refund.order?.userId || '-',
        amount: parseFloat(refund.amount),
        reason: refund.reason,
        status: this.getStatusLabel(refund.status),
        reviewComment: refund.reviewComment || '-',
        operatorId: refund.operatorId || '-',
        createdAt: new Date(refund.createdAt).toLocaleString('zh-CN'),
        updatedAt: new Date(refund.updatedAt).toLocaleString('zh-CN')
      });
    });

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  static async generateAuditReport(options = {}) {
    const { startDate, endDate, entityType, operatorId, action } = options;
    const where = {};

    if (startDate) where.createdAt = { ...where.createdAt, [Op.gte]: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, [Op.lte]: new Date(endDate) };
    if (entityType) where.entityType = entityType;
    if (operatorId) where.operatorId = operatorId;
    if (action) where.action = action;

    return await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
  }

  static async exportAuditToExcel(logs) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('AuditLogs');

    sheet.columns = [
      { header: '实体类型', key: 'entityType', width: 15 },
      { header: '实体ID', key: 'entityId', width: 40 },
      { header: '操作类型', key: 'action', width: 15 },
      { header: '操作人ID', key: 'operatorId', width: 15 },
      { header: '操作人姓名', key: 'operatorName', width: 20 },
      { header: '旧值', key: 'oldValue', width: 50 },
      { header: '新值', key: 'newValue', width: 50 },
      { header: 'IP地址', key: 'ipAddress', width: 20 },
      { header: '操作时间', key: 'createdAt', width: 20 }
    ];

    logs.forEach(log => {
      sheet.addRow({
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        operatorId: log.operatorId,
        operatorName: log.operatorName,
        oldValue: log.oldValue || '-',
        newValue: log.newValue || '-',
        ipAddress: log.ipAddress || '-',
        createdAt: new Date(log.createdAt).toLocaleString('zh-CN')
      });
    });

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  static getStatusLabel(status) {
    const statusMap = {
      pending_review: '待审核',
      reviewing: '审核中',
      approved: '已通过',
      rejected: '已拒绝',
      processing: '处理中',
      completed: '已完成',
      failed: '失败'
    };
    return statusMap[status] || status;
  }

  static async getStatistics(options = {}) {
    const { startDate, endDate } = options;
    const where = {};

    if (startDate) where.createdAt = { ...where.createdAt, [Op.gte]: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, [Op.lte]: new Date(endDate) };

    const totalRefunds = await Refund.count({ where });
    const totalAmount = await Refund.sum('amount', { where });

    const statusCounts = await Refund.findAll({
      where,
      attributes: ['status', [Refund.sequelize.fn('COUNT', Refund.sequelize.col('id')), 'count']],
      group: ['status']
    });

    const statusDistribution = {};
    statusCounts.forEach(item => {
      statusDistribution[item.status] = parseInt(item.dataValues.count);
    });

    return {
      totalRefunds,
      totalAmount: totalAmount ? parseFloat(totalAmount) : 0,
      statusDistribution
    };
  }
}

module.exports = ReportService;