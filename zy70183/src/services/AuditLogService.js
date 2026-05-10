const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class AuditLogService {
  static async log(data) {
    try {
      const log = await AuditLog.create(data);
      logger.info(`[AUDIT_LOG] ${data.logType} - ${data.action}`, {
        enterpriseCode: data.enterpriseCode,
        periodCode: data.periodCode,
        operator: data.operator
      });
      return log;
    } catch (error) {
      logger.error('[AUDIT_LOG] 记录审计日志失败', error);
      throw error;
    }
  }

  static async logAttachmentUpload(data) {
    return this.log({
      logType: 'ATTACHMENT_UPLOAD',
      ...data,
      action: '上传附件'
    });
  }

  static async logAttachmentValidate(data) {
    return this.log({
      logType: 'ATTACHMENT_VALIDATE',
      ...data,
      action: '校验附件'
    });
  }

  static async logStatusChange(data) {
    return this.log({
      logType: 'STATUS_CHANGE',
      ...data,
      action: '状态变更'
    });
  }

  static async logManualCorrection(data) {
    return this.log({
      logType: 'MANUAL_CORRECTION',
      ...data,
      action: '人工修正'
    });
  }

  static async logSupplementTask(data) {
    return this.log({
      logType: 'SUPPLEMENT_TASK',
      ...data,
      action: data.action || '补传任务'
    });
  }

  static async logDeclaration(data) {
    return this.log({
      logType: 'DECLARATION',
      ...data,
      action: '申报操作'
    });
  }

  static async queryLogs(params) {
    const query = {};
    
    if (params.logType) query.logType = params.logType;
    if (params.enterpriseCode) query.enterpriseCode = params.enterpriseCode;
    if (params.periodCode) query.periodCode = params.periodCode;
    if (params.attachmentId) query.attachmentId = params.attachmentId;
    if (params.taskId) query.taskId = params.taskId;
    if (params.operator) query.operator = params.operator;
    
    if (params.startTime || params.endTime) {
      query.createdAt = {};
      if (params.startTime) query.createdAt.$gte = new Date(params.startTime);
      if (params.endTime) query.createdAt.$lte = new Date(params.endTime);
    }

    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
}

module.exports = AuditLogService;
