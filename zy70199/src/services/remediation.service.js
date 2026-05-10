const { models, TaskStatus, EmployeeStatus } = require('../models');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, StateConflictError, DuplicateOperationError } = require('../utils/error-handler');
const AuditService = require('./audit.service');
const DocumentService = require('./document.service');
const EmployeeService = require('./employee.service');

class RemediationService {
  static createTask(employeeId, documentId, data, userId = 'system') {
    const employee = models.Employee.findById(employeeId);
    if (!employee) {
      throw new NotFoundError(`员工不存在: ${employeeId}`);
    }
    
    const document = models.EmployeeDocument.findById(documentId);
    if (!document) {
      throw new NotFoundError(`资料不存在: ${documentId}`);
    }
    
    if (document.employeeId !== employeeId) {
      throw new ValidationError('资料不属于该员工');
    }
    
    const existingOpenTask = models.RemediationTask.findOne(t => 
      t.employeeId === employeeId && 
      t.documentId === documentId && 
      [TaskStatus.OPEN, TaskStatus.IN_PROGRESS].includes(t.status)
    );
    
    if (existingOpenTask) {
      throw new DuplicateOperationError(`该资料已有未完成的补齐任务`);
    }
    
    const task = models.RemediationTask.create({
      employeeId,
      documentId,
      documentName: document.name,
      documentCode: document.catalogCode,
      reason: data.reason || '需要补充提交资料',
      priority: data.priority || 'NORMAL',
      dueDate: data.dueDate,
      assignee: data.assignee || userId,
      notes: data.notes
    });
    
    AuditService.log('REMEDIATION_TASK_CREATED', 'RemediationTask', task.id, userId, {
      employeeId,
      documentId,
      documentName: document.name,
      reason: data.reason
    });
    
    EmployeeService.updateStatus(employeeId, EmployeeStatus.DOCUMENTS_INCOMPLETE, `创建补齐任务: ${document.name}`, userId);
    
    logger.info(`Created remediation task ${task.id} for employee ${employeeId}, document: ${document.name}`);
    return task;
  }

  static createBulkTasks(employeeId, documentIds, data, userId = 'system') {
    const results = {
      success: [],
      failed: []
    };
    
    for (const documentId of documentIds) {
      try {
        const task = this.createTask(employeeId, documentId, data, userId);
        results.success.push(task);
      } catch (error) {
        results.failed.push({
          documentId,
          error: error.message
        });
      }
    }
    
    return results;
  }

  static getTask(id) {
    const task = models.RemediationTask.findById(id);
    if (!task) {
      throw new NotFoundError(`补齐任务不存在: ${id}`);
    }
    return task;
  }

  static getEmployeeTasks(employeeId, filters = {}) {
    return models.RemediationTask.find(task => {
      if (task.employeeId !== employeeId) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.documentCode && task.documentCode !== filters.documentCode) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static getAllTasks(filters = {}) {
    return models.RemediationTask.find(task => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.assignee && task.assignee !== filters.assignee) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static startTask(taskId, userId = 'system') {
    const task = this.getTask(taskId);
    
    if (task.status !== TaskStatus.OPEN) {
      throw new StateConflictError(`任务状态为 ${task.status}，无法开始`);
    }
    
    models.RemediationTask.update(taskId, {
      status: TaskStatus.IN_PROGRESS,
      startedAt: new Date().toISOString(),
      assignee: userId
    });
    
    AuditService.log('REMEDIATION_TASK_STARTED', 'RemediationTask', taskId, userId, {
      employeeId: task.employeeId,
      documentName: task.documentName
    });
    
    logger.info(`Started remediation task ${taskId} for employee ${task.employeeId}`);
    return models.RemediationTask.findById(taskId);
  }

  static completeTask(taskId, data, userId = 'system') {
    const task = this.getTask(taskId);
    
    if (task.status === TaskStatus.COMPLETED) {
      throw new DuplicateOperationError('该任务已完成');
    }
    
    if (![TaskStatus.OPEN, TaskStatus.IN_PROGRESS].includes(task.status)) {
      throw new StateConflictError(`任务状态为 ${task.status}，无法完成`);
    }
    
    models.RemediationTask.update(taskId, {
      status: TaskStatus.COMPLETED,
      completedAt: new Date().toISOString(),
      completedBy: userId,
      completionNotes: data.notes,
      attempts: task.attempts + 1
    });
    
    AuditService.log('REMEDIATION_TASK_COMPLETED', 'RemediationTask', taskId, userId, {
      employeeId: task.employeeId,
      documentName: task.documentName
    });
    
    logger.info(`Completed remediation task ${taskId} for employee ${task.employeeId}`);
    
    return models.RemediationTask.findById(taskId);
  }

  static cancelTask(taskId, reason, userId = 'admin') {
    const task = this.getTask(taskId);
    
    if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.COMPLETED) {
      throw new DuplicateOperationError('该任务已完成或已取消');
    }
    
    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('取消原因至少需要5个字符');
    }
    
    models.RemediationTask.update(taskId, {
      status: TaskStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      cancelledBy: userId,
      cancellationReason: reason
    });
    
    AuditService.log('REMEDIATION_TASK_CANCELLED', 'RemediationTask', taskId, userId, {
      employeeId: task.employeeId,
      documentName: task.documentName,
      reason
    });
    
    logger.warn(`Cancelled remediation task ${taskId}: ${reason}`);
    return models.RemediationTask.findById(taskId);
  }

  static expireTask(taskId, userId = 'system') {
    const task = this.getTask(taskId);
    
    if (task.status !== TaskStatus.OPEN && task.status !== TaskStatus.IN_PROGRESS) {
      throw new DuplicateOperationError('该任务已处理完毕');
    }
    
    models.RemediationTask.update(taskId, {
      status: TaskStatus.EXPIRED,
      expiredAt: new Date().toISOString()
    });
    
    AuditService.log('REMEDIATION_TASK_EXPIRED', 'RemediationTask', taskId, userId, {
      employeeId: task.employeeId,
      documentName: task.documentName
    });
    
    logger.warn(`Remediation task ${taskId} expired for employee ${task.employeeId}`);
    return models.RemediationTask.findById(taskId);
  }

  static checkAndCreateTasksForMissingDocuments(employeeId, userId = 'system') {
    const missingDocs = DocumentService.getMissingRequiredDocuments(employeeId);
    const results = {
      created: [],
      skipped: []
    };
    
    for (const doc of missingDocs) {
      const existingOpenTask = models.RemediationTask.findOne(t => 
        t.employeeId === employeeId && 
        t.documentId === doc.id && 
        [TaskStatus.OPEN, TaskStatus.IN_PROGRESS].includes(t.status)
      );
      
      if (existingOpenTask) {
        results.skipped.push({
          documentId: doc.id,
          documentName: doc.name,
          reason: '已有未完成任务'
        });
        continue;
      }
      
      try {
        const task = this.createTask(employeeId, doc.id, {
          reason: `资料状态为 ${doc.status}，需要补充提交`,
          priority: 'HIGH'
        }, userId);
        results.created.push(task);
      } catch (error) {
        results.skipped.push({
          documentId: doc.id,
          documentName: doc.name,
          reason: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = RemediationService;
