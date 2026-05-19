import { v4 as uuidv4 } from 'uuid';
import { db } from '../storage/database';
import {
  EscortTask,
  Appointment,
  Escort,
  TaskStatus,
  TaskPriority,
  PermissionLevel,
} from '../types';

export interface CreateTaskOptions {
  appointmentId: string;
  priority?: TaskPriority;
  isInserted?: boolean;
  insertReason?: string;
  createdBy: string;
}

export interface AssignTaskOptions {
  taskId: string;
  escortId: string;
  operator: string;
  operatorLevel: PermissionLevel;
  reason?: string;
}

export interface TaskActionOptions {
  taskId: string;
  operator: string;
  operatorLevel: PermissionLevel;
  reason?: string;
}

export class TaskService {
  generateTaskNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `T${dateStr}${random}`;
  }

  createTaskFromAppointment(
    appointmentId: string,
    options: Omit<CreateTaskOptions, 'appointmentId'>
  ): EscortTask | null {
    const appointment = db.getAppointmentById(appointmentId);
    if (!appointment) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'APPOINTMENT_NOT_FOUND',
        message: `预约单 ${appointmentId} 不存在`,
        context: { appointmentId, options },
      });
      return null;
    }

    const existingTasks = db.getTasksByStatus('pending');
    const duplicate = existingTasks.find(t => t.appointmentId === appointmentId);
    if (duplicate) {
      return duplicate;
    }

    const taskNo = this.generateTaskNo();

    const taskData: Omit<EscortTask, 'id' | 'createdAt' | 'updatedAt'> = {
      taskNo,
      appointmentId,
      status: 'pending',
      priority: options.priority || 'normal',
      patientName: appointment.patientName,
      patientId: appointment.patientId,
      examType: appointment.examType,
      examLocation: appointment.examLocation,
      scheduledTime: appointment.scheduledTime,
      isInserted: options.isInserted || false,
      insertReason: options.insertReason,
      createdBy: options.createdBy,
    };

    const task = db.insertTask(taskData);

    db.insertHistoryRecord({
      entityType: 'task',
      entityId: task.id,
      action: 'create',
      newValue: task,
      operator: options.createdBy,
      operatorLevel: 'staff',
      reason: options.isInserted ? `插队任务：${options.insertReason || ''}` : '创建陪检任务',
    });

    return task;
  }

  assignTask(options: AssignTaskOptions): EscortTask | null {
    const task = db.getTaskById(options.taskId);
    if (!task) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'TASK_NOT_FOUND',
        message: `任务 ${options.taskId} 不存在`,
        context: options,
      });
      return null;
    }

    if (task.status !== 'pending') {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'INVALID_TASK_STATUS',
        message: `任务 ${options.taskId} 状态为 ${task.status}，无法分配`,
        context: { task, options },
      });
      return null;
    }

    const escort = db.getEscortById(options.escortId);
    if (!escort) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'ESCORT_NOT_FOUND',
        message: `陪检员 ${options.escortId} 不存在`,
        context: options,
      });
      return null;
    }

    if (escort.currentTaskCount >= escort.maxTaskCount) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'ESCORT_OVERLOAD',
        message: `陪检员 ${escort.name} 任务数已满 (${escort.currentTaskCount}/${escort.maxTaskCount})`,
        context: { task, escort, options },
      });
      return null;
    }

    const now = Date.now();
    const updatedTask = db.updateTask(options.taskId, {
      escortId: options.escortId,
      status: 'assigned',
      assignedAt: now,
    });

    if (updatedTask) {
      db.updateEscort(options.escortId, {
        currentTaskCount: escort.currentTaskCount + 1,
      });

      db.insertHistoryRecord({
        entityType: 'task',
        entityId: task.id,
        action: 'assign',
        oldValue: task,
        newValue: updatedTask,
        operator: options.operator,
        operatorLevel: options.operatorLevel,
        reason: options.reason || '分配陪检员',
      });
    }

    return updatedTask;
  }

  acceptTask(options: TaskActionOptions): EscortTask | null {
    const task = db.getTaskById(options.taskId);
    if (!task) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'TASK_NOT_FOUND',
        message: `任务 ${options.taskId} 不存在`,
        context: options,
      });
      return null;
    }

    if (task.status !== 'assigned') {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'INVALID_TASK_STATUS',
        message: `任务 ${options.taskId} 状态为 ${task.status}，无法接单`,
        context: { task, options },
      });
      return null;
    }

    const now = Date.now();
    const waitDuration = Math.floor((now - (task.assignedAt || now)) / 1000 / 60);

    const updatedTask = db.updateTask(options.taskId, {
      status: 'in_progress',
      acceptedAt: now,
      startedAt: now,
      waitDuration,
    });

    if (updatedTask) {
      db.insertHistoryRecord({
        entityType: 'task',
        entityId: task.id,
        action: 'accept',
        oldValue: task,
        newValue: updatedTask,
        operator: options.operator,
        operatorLevel: options.operatorLevel,
        reason: options.reason || '陪检员接单',
      });
    }

    return updatedTask;
  }

  completeTask(options: TaskActionOptions): EscortTask | null {
    const task = db.getTaskById(options.taskId);
    if (!task) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'TASK_NOT_FOUND',
        message: `任务 ${options.taskId} 不存在`,
        context: options,
      });
      return null;
    }

    if (task.status !== 'in_progress') {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'INVALID_TASK_STATUS',
        message: `任务 ${options.taskId} 状态为 ${task.status}，无法完成`,
        context: { task, options },
      });
      return null;
    }

    const now = Date.now();
    const actualDuration = Math.floor((now - (task.startedAt || now)) / 1000 / 60);

    const updatedTask = db.updateTask(options.taskId, {
      status: 'completed',
      completedAt: now,
      actualDuration,
    });

    if (updatedTask && task.escortId) {
      const escort = db.getEscortById(task.escortId);
      if (escort) {
        db.updateEscort(task.escortId, {
          currentTaskCount: Math.max(0, escort.currentTaskCount - 1),
        });
      }

      db.insertHistoryRecord({
        entityType: 'task',
        entityId: task.id,
        action: 'complete',
        oldValue: task,
        newValue: updatedTask,
        operator: options.operator,
        operatorLevel: options.operatorLevel,
        reason: options.reason || '完成陪检任务',
      });
    }

    return updatedTask;
  }

  cancelTask(options: TaskActionOptions & { cancelReason: string }): EscortTask | null {
    const task = db.getTaskById(options.taskId);
    if (!task) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'TASK_NOT_FOUND',
        message: `任务 ${options.taskId} 不存在`,
        context: options,
      });
      return null;
    }

    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'timeout') {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'INVALID_TASK_STATUS',
        message: `任务 ${options.taskId} 状态为 ${task.status}，无法取消`,
        context: { task, options },
      });
      return null;
    }

    const now = Date.now();
    const updatedTask = db.updateTask(options.taskId, {
      status: 'cancelled',
      cancelledAt: now,
      cancelReason: options.cancelReason,
    });

    if (updatedTask && task.escortId) {
      const escort = db.getEscortById(task.escortId);
      if (escort) {
        db.updateEscort(task.escortId, {
          currentTaskCount: Math.max(0, escort.currentTaskCount - 1),
        });
      }

      db.insertHistoryRecord({
        entityType: 'task',
        entityId: task.id,
        action: 'cancel',
        oldValue: task,
        newValue: updatedTask,
        operator: options.operator,
        operatorLevel: options.operatorLevel,
        reason: `取消任务：${options.cancelReason}`,
      });
    }

    return updatedTask;
  }

  markTaskTimeout(options: TaskActionOptions & { timeoutReason: string }): EscortTask | null {
    const task = db.getTaskById(options.taskId);
    if (!task) {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'TASK_NOT_FOUND',
        message: `任务 ${options.taskId} 不存在`,
        context: options,
      });
      return null;
    }

    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'timeout') {
      return null;
    }

    const now = Date.now();
    const updatedTask = db.updateTask(options.taskId, {
      status: 'timeout',
      timeoutAt: now,
      timeoutReason: options.timeoutReason,
    });

    if (updatedTask && task.escortId) {
      const escort = db.getEscortById(task.escortId);
      if (escort) {
        db.updateEscort(task.escortId, {
          currentTaskCount: Math.max(0, escort.currentTaskCount - 1),
        });
      }

      db.insertHistoryRecord({
        entityType: 'task',
        entityId: task.id,
        action: 'timeout',
        oldValue: task,
        newValue: updatedTask,
        operator: options.operator,
        operatorLevel: options.operatorLevel,
        reason: `任务超时：${options.timeoutReason}`,
      });
    }

    return updatedTask;
  }

  insertTask(options: CreateTaskOptions & { insertReason: string }): EscortTask | null {
    const task = this.createTaskFromAppointment(options.appointmentId, {
      ...options,
      isInserted: true,
      priority: 'urgent',
    });

    return task;
  }

  reassignTask(options: AssignTaskOptions): EscortTask | null {
    const task = db.getTaskById(options.taskId);
    if (!task) {
      return null;
    }

    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'timeout') {
      db.insertErrorLog({
        errorType: 'business',
        errorCode: 'INVALID_TASK_STATUS',
        message: `任务 ${options.taskId} 状态为 ${task.status}，无法改派`,
        context: { task, options },
      });
      return null;
    }

    const oldEscortId = task.escortId;

    if (oldEscortId) {
      const oldEscort = db.getEscortById(oldEscortId);
      if (oldEscort) {
        db.updateEscort(oldEscortId, {
          currentTaskCount: Math.max(0, oldEscort.currentTaskCount - 1),
        });
      }
    }

    return this.assignTask(options);
  }

  getPendingTasks(): EscortTask[] {
    return db.getTasksByStatus('pending');
  }

  getTasksByEscort(escortId: string): EscortTask[] {
    return db.getTasksByEscort(escortId);
  }

  getTaskStatistics(): {
    total: number;
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    timeout: number;
    avgWaitTime: number;
    avgDuration: number;
  } {
    const pending = db.getTasksByStatus('pending');
    const assigned = db.getTasksByStatus('assigned');
    const inProgress = db.getTasksByStatus('in_progress');
    const completed = db.getTasksByStatus('completed');
    const cancelled = db.getTasksByStatus('cancelled');
    const timeout = db.getTasksByStatus('timeout');

    const allTasks = [...pending, ...assigned, ...inProgress, ...completed, ...cancelled, ...timeout];

    const waitTimes = allTasks
      .filter(t => t.waitDuration !== undefined && t.waitDuration !== null)
      .map(t => t.waitDuration as number);

    const durations = allTasks
      .filter(t => t.actualDuration !== undefined && t.actualDuration !== null)
      .map(t => t.actualDuration as number);

    return {
      total: allTasks.length,
      pending: pending.length,
      assigned: assigned.length,
      inProgress: inProgress.length,
      completed: completed.length,
      cancelled: cancelled.length,
      timeout: timeout.length,
      avgWaitTime: waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    };
  }

  checkAndHandleTimeouts(timeoutMinutes: number = 30): number {
    const assignedTasks = db.getTasksByStatus('assigned');
    const now = Date.now();
    let timeoutCount = 0;

    for (const task of assignedTasks) {
      if (task.assignedAt) {
        const elapsed = (now - task.assignedAt) / 1000 / 60;
        if (elapsed >= timeoutMinutes) {
          this.markTaskTimeout({
            taskId: task.id,
            operator: 'system',
            operatorLevel: 'admin',
            timeoutReason: `分配后 ${Math.floor(elapsed)} 分钟未接单，系统自动超时`,
          });
          timeoutCount++;
        }
      }
    }

    return timeoutCount;
  }

  getTaskHistory(taskId: string) {
    return db.getHistoryByEntity('task', taskId);
  }
}

export const taskService = new TaskService();
