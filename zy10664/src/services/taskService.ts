import {
  Task,
  TaskStatus,
  AuditAction,
  RecoveryCondition,
  TaskDetailResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  ApplyRecoveryRequest,
  AuditRecoveryRequest,
  WithdrawRequest,
  ManualRemarkRequest,
  RecordFailureRequest,
  TaskQuery,
  ImportResult
} from '../types';
import { store } from '../store';
import { validator } from '../utils/validator';

const FUSE_THRESHOLD = 3;

export class TaskService {
  createTask(request: CreateTaskRequest): { success: boolean; data?: Task; errors?: any[] } {
    if (!validator.validateCreateTask(request)) {
      return { success: false, errors: validator.getErrors() };
    }

    const existing = store.getTaskByCode(request.taskCode);
    if (existing) {
      return {
        success: false,
        errors: [{ field: 'taskCode', message: '任务编码已存在', rule: 'UNIQUE' }]
      };
    }

    const task = store.createTask({
      taskName: request.taskName,
      taskCode: request.taskCode,
      schedulerName: request.schedulerName
    });

    store.addAuditHistory(task.id, {
      action: AuditAction.CREATE,
      operator: 'system'
    });

    return { success: true, data: task };
  }

  getTaskDetail(id: string): { success: boolean; data?: TaskDetailResponse; message?: string } {
    const task = store.getTask(id);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }

    const recoveryConditions = store.getRecoveryConditions(id);
    const failureRecords = store.getFailureRecords(id);
    const auditHistories = store.getAuditHistories(id);

    return {
      success: true,
      data: {
        ...task,
        recoveryConditions,
        failureRecords,
        auditHistories
      }
    };
  }

  updateTask(id: string, request: UpdateTaskRequest): { success: boolean; data?: Task; errors?: any[]; message?: string } {
    const task = store.getTask(id);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }

    if (!validator.validateUpdateTask(request)) {
      return { success: false, errors: validator.getErrors() };
    }

    const updated = store.updateTask(id, request);
    if (updated) {
      store.addAuditHistory(id, {
        action: AuditAction.UPDATE,
        operator: 'system',
        remark: '更新任务信息'
      });
    }

    return { success: true, data: updated };
  }

  listTasks(query?: TaskQuery): { success: boolean; data: { total: number; list: Task[] } } {
    const result = store.listTasks(query);
    return {
      success: true,
      data: {
        total: result.total,
        list: result.data
      }
    };
  }

  recordFailure(id: string, request: RecordFailureRequest): { success: boolean; data?: Task; errors?: any[]; message?: string } {
    const task = store.getTask(id);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }

    if (!validator.validateRecordFailure(request)) {
      return { success: false, errors: validator.getErrors() };
    }

    store.addFailureRecord(id, {
      failureTime: new Date(),
      errorMessage: request.errorMessage,
      errorStack: request.errorStack,
      retryCount: request.retryCount,
      isInQueue: true,
      isProcessed: false
    });

    const newFailureCount = task.failureCount + 1;
    const hasQueuedRetry = true;

    if (newFailureCount >= FUSE_THRESHOLD && task.status === TaskStatus.RUNNING) {
      const updated = store.updateTask(id, {
        failureCount: newFailureCount,
        status: TaskStatus.FUSED,
        fuseReason: `连续失败${newFailureCount}次触发熔断`,
        fusedAt: new Date(),
        hasQueuedRetry
      });

      store.addAuditHistory(id, {
        action: AuditAction.FUSE,
        operator: 'system',
        oldStatus: TaskStatus.RUNNING,
        newStatus: TaskStatus.FUSED,
        remark: `连续失败${newFailureCount}次触发熔断`
      });

      return { success: true, data: updated };
    }

    const updated = store.updateTask(id, {
      failureCount: newFailureCount,
      hasQueuedRetry
    });

    return { success: true, data: updated };
  }

  applyRecovery(id: string, request: ApplyRecoveryRequest): { success: boolean; data?: Task; errors?: any[]; message?: string } {
    const task = store.getTask(id);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }

    if (task.status !== TaskStatus.FUSED) {
      return {
        success: false,
        errors: [{ field: 'status', message: '只有熔断状态的任务才能申请恢复', rule: 'STATUS' }]
      };
    }

    if (!validator.validateApplyRecovery(request)) {
      return { success: false, errors: validator.getErrors() };
    }

    for (const condition of request.recoveryConditions) {
      store.addRecoveryCondition(id, {
        type: condition.type,
        description: condition.description
      });
    }

    const updated = store.updateTask(id, {
      status: TaskStatus.RECOVERY_APPLY,
      recoveryApplyAt: new Date(),
      recoveryApplicant: request.applicant,
      recoveryRemark: request.recoveryRemark
    });

    store.addAuditHistory(id, {
      action: AuditAction.APPLY_RECOVERY,
      operator: request.applicant,
      oldStatus: TaskStatus.FUSED,
      newStatus: TaskStatus.RECOVERY_APPLY,
      remark: request.recoveryRemark
    });

    return { success: true, data: updated };
  }

  auditRecovery(id: string, request: AuditRecoveryRequest): { success: boolean; data?: Task; errors?: any[]; message?: string } {
    const task = store.getTask(id);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }

    if (task.status !== TaskStatus.RECOVERY_APPLY) {
      return {
        success: false,
        errors: [{ field: 'status', message: '只有申请恢复状态的任务才能审核', rule: 'STATUS' }]
      };
    }

    if (!validator.validateAuditRecovery(request)) {
      return { success: false, errors: validator.getErrors() };
    }

    if (request.approved) {
      const conditions = store.getRecoveryConditions(id);
      const allMet = conditions.every(c => c.isMet);
      
      if (!allMet && conditions.length > 0) {
        return {
          success: false,
          errors: [{ field: 'recoveryConditions', message: '恢复条件未全部满足', rule: 'CONDITIONS' }]
        };
      }

      const updated = store.updateTask(id, {
        status: TaskStatus.RECOVERED,
        recoveredAt: new Date(),
        recoveryAuditor: request.auditor,
        failureCount: 0
      });

      store.addAuditHistory(id, {
        action: AuditAction.APPROVE_RECOVERY,
        operator: request.auditor,
        oldStatus: TaskStatus.RECOVERY_APPLY,
        newStatus: TaskStatus.RECOVERED,
        remark: request.auditRemark
      });

      return { success: true, data: updated };
    } else {
      const updated = store.updateTask(id, {
        status: TaskStatus.FUSED
      });

      store.addAuditHistory(id, {
        action: AuditAction.REJECT_RECOVERY,
        operator: request.auditor,
        oldStatus: TaskStatus.RECOVERY_APPLY,
        newStatus: TaskStatus.FUSED,
        remark: request.auditRemark
      });

      return { success: true, data: updated };
    }
  }

  withdraw(id: string, request: WithdrawRequest): { success: boolean; data?: Task; errors?: any[]; message?: string } {
    const task = store.getTask(id);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }

    if (task.status !== TaskStatus.RECOVERY_APPLY) {
      return {
        success: false,
        errors: [{ field: 'status', message: '只有申请恢复状态的任务才能撤回', rule: 'STATUS' }]
      };
    }

    if (!validator.validateWithdraw(request)) {
      return { success: false, errors: validator.getErrors() };
    }

    const updated = store.updateTask(id, {
      status: TaskStatus.FUSED
    });

    store.addAuditHistory(id, {
      action: AuditAction.WITHDRAW,
      operator: request.operator,
      oldStatus: TaskStatus.RECOVERY_APPLY,
      newStatus: TaskStatus.FUSED,
      remark: request.reason
    });

    return { success: true, data: updated };
  }

  addManualRemark(id: string, request: ManualRemarkRequest): { success: boolean; data?: Task; errors?: any[]; message?: string } {
    const task = store.getTask(id);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }

    if (!validator.validateManualRemark(request)) {
      return { success: false, errors: validator.getErrors() };
    }

    const failureRecords = store.getFailureRecords(id);
    const queuedRecords = failureRecords.filter(r => r.isInQueue && !r.isProcessed);
    for (const record of queuedRecords) {
      store.updateFailureRecord(record.id, { isProcessed: true });
    }

    const updated = store.updateTask(id, {
      manualRemark: request.remark,
      hasQueuedRetry: false
    });

    store.addAuditHistory(id, {
      action: AuditAction.MANUAL_REMARK,
      operator: request.operator,
      remark: `${request.remark} (已处理${queuedRecords.length}条队列中的重试记录)`
    });

    return { success: true, data: updated };
  }

  meetRecoveryCondition(taskId: string, conditionId: string, operator: string): { success: boolean; data?: RecoveryCondition; message?: string } {
    const condition = store.updateRecoveryCondition(conditionId, {
      isMet: true,
      metAt: new Date(),
      metBy: operator
    });

    if (!condition) {
      return { success: false, message: '恢复条件不存在' };
    }

    return { success: true, data: condition };
  }

  exportTasks(): { success: boolean; data: Task[] } {
    return {
      success: true,
      data: store.getAllTasks()
    };
  }

  importTasks(data: any[]): { success: boolean; data: ImportResult } {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      conflicts: []
    };

    data.forEach((row, index) => {
      const rowNum = index + 1;
      
      if (!validator.validateImportRow(row, rowNum)) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          data: row,
          errors: validator.getErrors()
        });
        return;
      }

      const existing = store.getTaskByCode(row.taskCode);
      if (existing) {
        result.conflicts.push({
          row: rowNum,
          data: row,
          existingTaskId: existing.id,
          message: `任务编码 ${row.taskCode} 已存在`
        });
        return;
      }

      const task = store.createTask({
        taskName: row.taskName,
        taskCode: row.taskCode,
        schedulerName: row.schedulerName
      });

      if (row.failureCount) {
        store.updateTask(task.id, { failureCount: parseInt(row.failureCount, 10) });
      }

      if (row.status && Object.values(TaskStatus).includes(row.status)) {
        store.updateTask(task.id, { status: row.status });
      }

      store.addAuditHistory(task.id, {
        action: AuditAction.CREATE,
        operator: 'import',
        remark: `从第${rowNum}行导入`
      });

      result.success++;
    });

    return { success: true, data: result };
  }
}

export const taskService = new TaskService();
