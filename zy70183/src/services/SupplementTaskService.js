const SupplementTask = require('../models/SupplementTask');
const DeclarationRecord = require('../models/DeclarationRecord');
const Attachment = require('../models/Attachment');
const AuditLogService = require('./AuditLogService');
const logger = require('../utils/logger');

class SupplementTaskService {
  static async createFromDeclaration(enterpriseCode, periodCode, operatorInfo = {}) {
    const declaration = await DeclarationRecord.findOne({ enterpriseCode, periodCode });
    if (!declaration) {
      throw new Error('申报记录不存在');
    }

    const existingTasks = await SupplementTask.find({
      enterpriseCode,
      periodCode,
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    });

    if (existingTasks.length > 0) {
      throw new Error('已有未完成的补传任务');
    }

    const requiredAttachments = [];

    if (declaration.validationResult.missingAttachments) {
      declaration.validationResult.missingAttachments.forEach(item => {
        requiredAttachments.push({
          attachmentType: item.attachmentType,
          attachmentName: item.attachmentName,
          reason: '缺失必填附件'
        });
      });
    }

    if (declaration.validationResult.invalidAttachments) {
      declaration.validationResult.invalidAttachments.forEach(item => {
        requiredAttachments.push({
          attachmentType: item.attachmentType,
          attachmentName: item.attachmentName,
          reason: item.reasons?.join('; ') || '附件校验不通过',
          originalAttachmentId: item.attachmentId
        });
      });
    }

    if (requiredAttachments.length === 0) {
      throw new Error('当前申报状态正常，无需创建补传任务');
    }

    const taskType = declaration.validationResult.missingAttachments?.length > 0 
      ? 'MISSING' 
      : 'INVALID';

    const task = await SupplementTask.create({
      enterpriseCode,
      periodCode,
      taskType,
      requiredAttachments,
      status: 'PENDING',
      createdBy: operatorInfo.operator || 'system'
    });

    await AuditLogService.logSupplementTask({
      enterpriseCode,
      periodCode,
      taskId: task.taskId,
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      ipAddress: operatorInfo.ip,
      action: '创建补传任务',
      details: {
        taskType,
        requiredCount: requiredAttachments.length,
        attachments: requiredAttachments
      }
    });

    logger.info(`[SUPPLEMENT_TASK] 创建补传任务：${task.taskId}`, {
      enterpriseCode,
      periodCode,
      taskType,
      requiredCount: requiredAttachments.length
    });

    return task;
  }

  static async createManualTask(data, operatorInfo = {}) {
    const { enterpriseCode, periodCode, requiredAttachments, reason, deadline, assignedTo } = data;

    if (!enterpriseCode || !periodCode) {
      throw new Error('企业代码和申报期不能为空');
    }

    if (!requiredAttachments || requiredAttachments.length === 0) {
      throw new Error('请指定需要补传的附件');
    }

    const task = await SupplementTask.create({
      enterpriseCode,
      periodCode,
      taskType: 'MANUAL_REQUEST',
      requiredAttachments: requiredAttachments.map(a => ({
        ...a,
        reason: reason || a.reason || '人工发起补传'
      })),
      deadline: deadline ? new Date(deadline) : null,
      assignedTo,
      status: 'PENDING',
      createdBy: operatorInfo.operator || 'system'
    });

    await AuditLogService.logSupplementTask({
      enterpriseCode,
      periodCode,
      taskId: task.taskId,
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      ipAddress: operatorInfo.ip,
      action: '人工创建补传任务',
      reason,
      details: {
        requiredAttachments,
        deadline,
        assignedTo
      }
    });

    return task;
  }

  static async updateTaskStatus(taskId, status, operatorInfo = {}) {
    const task = await SupplementTask.findOne({ taskId });
    if (!task) {
      throw new Error('任务不存在');
    }

    const oldStatus = task.status;
    const validTransitions = {
      PENDING: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
      EXPIRED: []
    };

    if (!validTransitions[oldStatus]?.includes(status)) {
      throw new Error(`无法从 ${oldStatus} 转换到 ${status}`);
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.completedBy = operatorInfo.operator || 'system';
    }

    await SupplementTask.updateOne({ taskId }, updateData);

    const updatedTask = await SupplementTask.findOne({ taskId });

    await AuditLogService.logSupplementTask({
      enterpriseCode: task.enterpriseCode,
      periodCode: task.periodCode,
      taskId,
      operator: operatorInfo.operator || 'system',
      operatorRole: operatorInfo.role,
      ipAddress: operatorInfo.ip,
      action: '更新任务状态',
      oldValue: { status: oldStatus },
      newValue: { status },
      details: { completedBy: operatorInfo.operator }
    });

    return updatedTask;
  }

  static async checkTaskCompletion(taskId, operatorInfo = {}) {
    const task = await SupplementTask.findOne({ taskId });
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status === 'COMPLETED') {
      return { isCompleted: true, task };
    }

    const attachments = await Attachment.find({
      enterpriseCode: task.enterpriseCode,
      periodCode: task.periodCode,
      isLatest: true
    });

    const completedAttachments = [];
    const pendingAttachments = [];

    for (const required of task.requiredAttachments) {
      const uploaded = attachments.find(
        a => a.attachmentType === required.attachmentType
      );

      if (uploaded && (uploaded.validationStatus === 'VALID' || uploaded.validationStatus === 'MANUAL_CORRECTED')) {
        completedAttachments.push(required);
      } else {
        pendingAttachments.push(required);
      }
    }

    const isCompleted = pendingAttachments.length === 0;

    if (isCompleted && task.status !== 'COMPLETED') {
      await this.updateTaskStatus(taskId, 'COMPLETED', operatorInfo);
    }

    return {
      isCompleted,
      task,
      completedAttachments,
      pendingAttachments,
      progress: {
        total: task.requiredAttachments.length,
        completed: completedAttachments.length,
        pending: pendingAttachments.length
      }
    };
  }

  static async getTasks(params) {
    const query = {};
    
    if (params.enterpriseCode) query.enterpriseCode = params.enterpriseCode;
    if (params.periodCode) query.periodCode = params.periodCode;
    if (params.status) query.status = params.status;
    if (params.taskType) query.taskType = params.taskType;
    if (params.assignedTo) query.assignedTo = params.assignedTo;

    if (params.overdue === 'true') {
      query.deadline = { $lt: new Date() };
      query.status = { $in: ['PENDING', 'IN_PROGRESS'] };
    }

    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const [tasks, total] = await Promise.all([
      SupplementTask.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      SupplementTask.countDocuments(query)
    ]);

    return {
      tasks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getTaskById(taskId) {
    const task = await SupplementTask.findOne({ taskId });
    if (!task) {
      throw new Error('任务不存在');
    }
    return task;
  }

  static async getStatistics(params = {}) {
    const match = {};
    if (params.enterpriseCode) match.enterpriseCode = params.enterpriseCode;
    if (params.periodCode) match.periodCode = params.periodCode;

    const stats = await SupplementTask.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const taskTypeStats = await SupplementTask.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$taskType',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      byStatus: stats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byType: taskTypeStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }
}

module.exports = SupplementTaskService;
