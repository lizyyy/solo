const { AuditLog, User } = require('../models');
const logger = require('../config/logger');

const createAuditLog = async (options) => {
  const { action, module, recordId, operatorId, oldValues, newValues, ipAddress, userAgent, remark } = options;

  try {
    const auditLog = await AuditLog.create({
      action,
      module,
      recordId: recordId ? String(recordId) : null,
      operatorId,
      oldValues,
      newValues,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      remark: remark || null
    });

    logger.info('审计日志创建成功', {
      action,
      module,
      recordId,
      operatorId
    });

    return auditLog;
  } catch (error) {
    logger.error('审计日志创建失败', { error: error.message, action, module });
    throw error;
  }
};

const getAuditLogs = async (options = {}) => {
  const { page = 1, pageSize = 20, action, module, operatorId, startDate, endDate } = options;
  
  const where = {};
  if (action) where.action = action;
  if (module) where.module = module;
  if (operatorId) where.operatorId = operatorId;
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'operator',
        attributes: ['id', 'username', 'realName']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  return {
    total: count,
    page,
    pageSize,
    list: rows
  };
};

const logTicketCreate = (ticket, operatorId, ipAddress, userAgent) => {
  return createAuditLog({
    action: 'create',
    module: 'ticket',
    recordId: ticket.id,
    operatorId,
    newValues: {
      ticketNo: ticket.ticketNo,
      stationId: ticket.stationId,
      problemType: ticket.problemType,
      status: ticket.status
    },
    ipAddress,
    userAgent,
    remark: '创建客服单'
  });
};

const logTicketUpdate = (oldTicket, newTicket, operatorId, ipAddress, userAgent) => {
  const changedFields = {};
  const fieldsToCheck = ['problemType', 'status', 'priority', 'operatorId', 'reviewerId', 'resolution'];
  
  fieldsToCheck.forEach(field => {
    if (oldTicket[field] !== newTicket[field]) {
      changedFields[field] = {
        old: oldTicket[field],
        new: newTicket[field]
      };
    }
  });

  if (Object.keys(changedFields).length === 0) {
    return null;
  }

  return createAuditLog({
    action: 'update',
    module: 'ticket',
    recordId: newTicket.id,
    operatorId,
    oldValues: Object.fromEntries(
      Object.entries(changedFields).map(([k, v]) => [k, v.old])
    ),
    newValues: Object.fromEntries(
      Object.entries(changedFields).map(([k, v]) => [k, v.new])
    ),
    ipAddress,
    userAgent,
    remark: `更新客服单字段: ${Object.keys(changedFields).join(', ')}`
  });
};

const logTicketClassify = (ticket, oldType, newType, operatorId, ipAddress, userAgent) => {
  return createAuditLog({
    action: 'classify',
    module: 'ticket',
    recordId: ticket.id,
    operatorId,
    oldValues: { problemType: oldType },
    newValues: { problemType: newType },
    ipAddress,
    userAgent,
    remark: '客服单分类'
  });
};

const logTicketReview = (ticket, operatorId, ipAddress, userAgent) => {
  return createAuditLog({
    action: 'review',
    module: 'ticket',
    recordId: ticket.id,
    operatorId,
    newValues: { reviewerId: operatorId, status: 'resolved' },
    ipAddress,
    userAgent,
    remark: '客服单复核'
  });
};

const logImport = (importCount, operatorId, ipAddress, userAgent) => {
  return createAuditLog({
    action: 'import',
    module: 'ticket',
    operatorId,
    newValues: { importCount },
    ipAddress,
    userAgent,
    remark: `导入 ${importCount} 条客服单数据`
  });
};

const logExport = (exportCount, filters, operatorId, ipAddress, userAgent) => {
  return createAuditLog({
    action: 'export',
    module: 'ticket',
    operatorId,
    newValues: { exportCount, filters },
    ipAddress,
    userAgent,
    remark: `导出 ${exportCount} 条客服单数据`
  });
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  logTicketCreate,
  logTicketUpdate,
  logTicketClassify,
  logTicketReview,
  logImport,
  logExport
};
