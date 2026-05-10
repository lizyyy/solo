import { getDb } from '../database';
import {
  CompensationTask,
  CompensationType,
  TaskStatus,
  TaskExecutionResult
} from '../types';

export class CompensationService {
  private taskExecutors: Map<CompensationType, (task: CompensationTask) => Promise<Record<string, any>>>;

  constructor() {
    this.taskExecutors = new Map();
    this.registerDefaultExecutors();
  }

  private registerDefaultExecutors(): void {
    this.taskExecutors.set(CompensationType.REFUND, this.executeRefund.bind(this));
    this.taskExecutors.set(CompensationType.VOUCHER, this.executeVoucher.bind(this));
    this.taskExecutors.set(CompensationType.RESCHEDULE, this.executeReschedule.bind(this));
    this.taskExecutors.set(CompensationType.MANUAL, this.executeManual.bind(this));
  }

  createCompensationTasks(
    scheduleId: string,
    compensationTypes: CompensationType[],
    payload: Record<string, any> = {},
    maxAttempts: number = 3
  ): CompensationTask[] {
    const db = getDb();
    const tasks: CompensationTask[] = [];

    for (const type of compensationTypes) {
      const task = db.createCompensationTask(scheduleId, type, payload, maxAttempts);
      tasks.push(task);
    }

    return tasks;
  }

  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    const db = getDb();
    const task = db.getCompensationTask(taskId);

    if (!task) {
      return {
        taskId,
        success: false,
        status: TaskStatus.FAILED,
        attempts: 0,
        errorMessage: '任务不存在'
      };
    }

    if (task.status === TaskStatus.SUCCESS) {
      return {
        taskId,
        success: true,
        status: task.status,
        attempts: task.attempts,
        result: task.result
      };
    }

    if (task.attempts >= task.maxAttempts) {
      return {
        taskId,
        success: false,
        status: TaskStatus.FAILED,
        attempts: task.attempts,
        errorMessage: task.errorMessage || '已达最大重试次数'
      };
    }

    const executor = this.taskExecutors.get(task.type);
    if (!executor) {
      db.updateCompensationTask(taskId, {
        status: TaskStatus.FAILED,
        attempts: task.attempts + 1,
        lastAttemptAt: Date.now(),
        errorMessage: `未找到类型为 ${task.type} 的执行器`
      });

      return {
        taskId,
        success: false,
        status: TaskStatus.FAILED,
        attempts: task.attempts + 1,
        errorMessage: `未找到类型为 ${task.type} 的执行器`
      };
    }

    db.updateCompensationTask(taskId, {
      status: TaskStatus.RUNNING,
      attempts: task.attempts + 1,
      lastAttemptAt: Date.now()
    });

    try {
      const result = await executor(task);
      db.updateCompensationTask(taskId, {
        status: TaskStatus.SUCCESS,
        result
      });

      return {
        taskId,
        success: true,
        status: TaskStatus.SUCCESS,
        attempts: task.attempts + 1,
        result
      };
    } catch (error: any) {
      const isLastAttempt = task.attempts + 1 >= task.maxAttempts;
      db.updateCompensationTask(taskId, {
        status: isLastAttempt ? TaskStatus.FAILED : TaskStatus.FAILED,
        errorMessage: error.message || '执行失败'
      });

      return {
        taskId,
        success: false,
        status: isLastAttempt ? TaskStatus.FAILED : TaskStatus.FAILED,
        attempts: task.attempts + 1,
        errorMessage: error.message || '执行失败'
      };
    }
  }

  async executePendingTasks(): Promise<TaskExecutionResult[]> {
    const db = getDb();
    const tasks = db.getPendingCompensationTasks();
    const results: TaskExecutionResult[] = [];

    for (const task of tasks) {
      const result = await this.executeTask(task.id);
      results.push(result);
    }

    return results;
  }

  retryTask(taskId: string): Promise<TaskExecutionResult> {
    const db = getDb();
    const task = db.getCompensationTask(taskId);
    if (task && task.status === TaskStatus.FAILED) {
      db.updateCompensationTask(taskId, {
        status: TaskStatus.PENDING
      });
    }
    return this.executeTask(taskId);
  }

  getTaskStatus(taskId: string): CompensationTask | undefined {
    const db = getDb();
    return db.getCompensationTask(taskId);
  }

  getTasksBySchedule(scheduleId: string): CompensationTask[] {
    const db = getDb();
    return db.getCompensationTasksBySchedule(scheduleId);
  }

  registerExecutor(type: CompensationType, executor: (task: CompensationTask) => Promise<Record<string, any>>): void {
    this.taskExecutors.set(type, executor);
  }

  private async executeRefund(task: CompensationTask): Promise<Record<string, any>> {
    const { ticketIds = [], amount = 0 } = task.payload;
    
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      throw new Error('缺少退款票号列表');
    }

    if (amount <= 0) {
      throw new Error('退款金额必须大于0');
    }

    const refundId = `REF-${Date.now()}`;
    
    return {
      refundId,
      ticketIds,
      amount,
      status: 'completed',
      processedAt: Date.now()
    };
  }

  private async executeVoucher(task: CompensationTask): Promise<Record<string, any>> {
    const { userId, voucherAmount = 0, reason = '' } = task.payload;

    if (!userId) {
      throw new Error('缺少用户ID');
    }

    if (voucherAmount <= 0) {
      throw new Error('优惠券金额必须大于0');
    }

    const voucherCode = `VCH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    return {
      voucherCode,
      userId,
      amount: voucherAmount,
      reason,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
  }

  private async executeReschedule(task: CompensationTask): Promise<Record<string, any>> {
    const db = getDb();
    const { newTime, originalScheduleId } = task.payload;

    if (!newTime) {
      throw new Error('缺少新的排片时间');
    }

    const schedule = db.getSchedule(originalScheduleId || task.scheduleId);
    if (!schedule) {
      throw new Error('排片不存在');
    }

    const movie = db.getMovie(schedule.movieId);
    if (!movie) {
      throw new Error('影片不存在');
    }

    const newEndTime = newTime + movie.duration * 60 * 1000;

    const overlapping = db.getSchedulesByHallAndTime(
      schedule.hallId,
      newTime,
      newEndTime
    ).filter((s: any) => s.id !== schedule.id);

    if (overlapping.length > 0) {
      throw new Error(`新时间与 ${overlapping.length} 场排片冲突`);
    }

    db.updateSchedule(schedule.id, {
      startAt: newTime,
      endAt: newEndTime
    });

    return {
      scheduleId: schedule.id,
      oldStartAt: schedule.startAt,
      oldEndAt: schedule.endAt,
      newStartAt: newTime,
      newEndAt: newEndTime,
      rescheduledAt: Date.now()
    };
  }

  private async executeManual(task: CompensationTask): Promise<Record<string, any>> {
    const { operatorId, description } = task.payload;

    if (!operatorId) {
      throw new Error('缺少操作员ID');
    }

    return {
      processed: true,
      operatorId,
      description,
      processedAt: Date.now(),
      note: '需要人工确认处理结果'
    };
  }
}

export const compensationService = new CompensationService();
