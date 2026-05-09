const ExcelJS = require('exceljs');
const moment = require('moment');
const PushMessage = require('../models/PushMessage');
const AuditLog = require('../models/AuditLog');
const auditService = require('./auditService');

async function generatePushReport(filters = {}) {
  const query = {};
  
  if (filters.startDate) {
    query.createdAt = { ...query.createdAt, $gte: new Date(filters.startDate) };
  }
  
  if (filters.endDate) {
    query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };
  }
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.pushType) {
    query.pushType = filters.pushType;
  }
  
  const messages = await PushMessage.find(query)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'username role')
    .lean();
  
  const stats = {
    total: messages.length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed').length,
    pending: messages.filter(m => ['pending', 'queued', 'processing'].includes(m.status)).length,
    cancelled: messages.filter(m => m.status === 'cancelled').length,
    totalDelivered: messages.reduce((sum, m) => sum + (m.deliveredCount || 0), 0),
    totalFailed: messages.reduce((sum, m) => sum + (m.failedCount || 0), 0),
  };
  
  return { messages, stats };
}

async function generateAuditReport(filters = {}) {
  const query = {};
  
  if (filters.startDate) {
    query.createdAt = { ...query.createdAt, $gte: new Date(filters.startDate) };
  }
  
  if (filters.endDate) {
    query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };
  }
  
  if (filters.action) {
    query.action = filters.action;
  }
  
  if (filters.userId) {
    query.userId = filters.userId;
  }
  
  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .lean();
  
  const actionStats = {};
  for (const log of logs) {
    actionStats[log.action] = (actionStats[log.action] || 0) + 1;
  }
  
  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  
  return {
    logs,
    stats: {
      total: logs.length,
      success: successCount,
      failed: failedCount,
      byAction: actionStats,
    },
  };
}

async function exportPushReportToExcel(filters = {}, user, req) {
  const { messages, stats } = await generatePushReport(filters);
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Live Push System';
  workbook.created = new Date();
  
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  
  summarySheet.addRow({ metric: 'Total Messages', value: stats.total });
  summarySheet.addRow({ metric: 'Sent', value: stats.sent });
  summarySheet.addRow({ metric: 'Failed', value: stats.failed });
  summarySheet.addRow({ metric: 'Pending', value: stats.pending });
  summarySheet.addRow({ metric: 'Cancelled', value: stats.cancelled });
  summarySheet.addRow({ metric: 'Total Delivered', value: stats.totalDelivered });
  summarySheet.addRow({ metric: 'Total Failed Deliveries', value: stats.totalFailed });
  
  summarySheet.getRow(1).font = { bold: true };
  
  const detailSheet = workbook.addWorksheet('Details');
  detailSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Type', key: 'pushType', width: 15 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Created By', key: 'createdBy', width: 20 },
    { header: 'Created At', key: 'createdAt', width: 25 },
    { header: 'Sent At', key: 'sentAt', width: 25 },
    { header: 'Delivered', key: 'deliveredCount', width: 12 },
    { header: 'Failed', key: 'failedCount', width: 12 },
    { header: 'Retries', key: 'retryCount', width: 10 },
    { header: 'Error', key: 'errorMessage', width: 40 },
  ];
  
  for (const msg of messages) {
    detailSheet.addRow({
      id: msg._id.toString(),
      title: msg.title,
      pushType: msg.pushType,
      priority: msg.priority,
      status: msg.status,
      createdBy: msg.createdBy?.username || 'Unknown',
      createdAt: moment(msg.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      sentAt: msg.sentAt ? moment(msg.sentAt).format('YYYY-MM-DD HH:mm:ss') : '',
      deliveredCount: msg.deliveredCount || 0,
      failedCount: msg.failedCount || 0,
      retryCount: msg.retryCount || 0,
      errorMessage: msg.errorMessage || '',
    });
  }
  
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.autoFilter = 'A1:L1';
  
  const buffer = await workbook.xlsx.writeBuffer();
  
  await auditService.logAction({
    action: 'report_exported',
    resourceType: 'report',
    userId: user._id,
    username: user.username,
    req,
    description: `Exported push report with ${messages.length} messages`,
  });
  
  return {
    buffer,
    filename: `push_report_${moment().format('YYYYMMDD_HHmmss')}.xlsx`,
  };
}

async function exportAuditReportToExcel(filters = {}, user, req) {
  const { logs, stats } = await generateAuditReport(filters);
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Live Push System';
  workbook.created = new Date();
  
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  
  summarySheet.addRow({ metric: 'Total Logs', value: stats.total });
  summarySheet.addRow({ metric: 'Success', value: stats.success });
  summarySheet.addRow({ metric: 'Failed', value: stats.failed });
  
  summarySheet.addRow({});
  summarySheet.addRow({ metric: 'By Action', value: '' });
  
  for (const [action, count] of Object.entries(stats.byAction)) {
    summarySheet.addRow({ metric: action, value: count });
  }
  
  summarySheet.getRow(1).font = { bold: true };
  
  const detailSheet = workbook.addWorksheet('Details');
  detailSheet.columns = [
    { header: 'Action', key: 'action', width: 25 },
    { header: 'Resource Type', key: 'resourceType', width: 15 },
    { header: 'User', key: 'username', width: 20 },
    { header: 'IP Address', key: 'ipAddress', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Created At', key: 'createdAt', width: 25 },
  ];
  
  for (const log of logs) {
    detailSheet.addRow({
      action: log.action,
      resourceType: log.resourceType,
      username: log.username,
      ipAddress: log.ipAddress || '',
      status: log.status,
      description: log.description || '',
      createdAt: moment(log.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    });
  }
  
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.autoFilter = 'A1:G1';
  
  const buffer = await workbook.xlsx.writeBuffer();
  
  await auditService.logAction({
    action: 'report_exported',
    resourceType: 'report',
    userId: user._id,
    username: user.username,
    req,
    description: `Exported audit report with ${logs.length} logs`,
  });
  
  return {
    buffer,
    filename: `audit_report_${moment().format('YYYYMMDD_HHmmss')}.xlsx`,
  };
}

module.exports = {
  generatePushReport,
  generateAuditReport,
  exportPushReportToExcel,
  exportAuditReportToExcel,
};
