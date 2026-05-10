import cron from 'node-cron';
import { addMinutes, addHours, differenceInMilliseconds } from 'date-fns';
import { ScheduledTask, TaskExecutionLog, TaskRunStatus } from '../types';
import { store } from '../dataStore/inMemoryStore';
import { TaskExecutionError, NotFoundError } from '../utils/errors';
import { LoggerContext, createLoggerContext } from '../utils/logger';
import { approvalFlowService, ApprovalContext } from './approvalFlowService';
import { ledgerService } from './ledgerService';

interface TaskDefinition {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  maxRetries?: number;
  retryDelayMinutes?: number;
  enabled?: boolean;
}

class TaskScheduler {
  private logger: LoggerContext;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private taskDefinitions: Map<string, TaskDefinition> = new Map();
  private isStarted: boolean = false;

  constructor(logger?: LoggerContext) {
    this.logger = logger || createLoggerContext();
    this.logger.addContext('service', 'TaskScheduler');
  }

  registerTask(definition: TaskDefinition): void {
    this.logger.info('Registering task', {
      name: definition.name,
      cronExpression: definition.cronExpression
    });

    this.taskDefinitions.set(definition.name, definition);

    const existingTask = store.scheduledTasksStore().findByName(definition.name);
    if (!existingTask) {
      store.scheduledTasksStore().create({
        name: definition.name,
        cronExpression: definition.cronExpression,
        isEnabled: definition.enabled ?? true,
        lastRunAt: null,
        lastRunStatus: 'PENDING',
        nextRunAt: null,
        retryCount: 0,
        maxRetries: definition.maxRetries ?? 3
      });
    }
  }

  start(): void {
    if (this.isStarted) {
      this.logger.warn('Task scheduler already started');
      return;
    }

    this.logger.info('Starting task scheduler');
    this.isStarted = true;

    const enabledTasks = store.scheduledTasksStore().findEnabled();
    
    for (const task of enabledTasks) {
      this.scheduleTask(task);
    }
  }

  stop(): void {
    this.logger.info('Stopping task scheduler');
    this.isStarted = false;

    for (const [taskId, job] of this.scheduledJobs) {
      job.stop();
      this.logger.debug('Stopped scheduled job', { taskId });
    }

    this.scheduledJobs.clear();
  }

  private scheduleTask(task: ScheduledTask): void {
    const definition = this.taskDefinitions.get(task.name);
    if (!definition) {
      this.logger.warn('No definition found for task', { taskName: task.name });
      return;
    }

    if (this.scheduledJobs.has(task.id)) {
      this.logger.debug('Task already scheduled', { taskId: task.id });
      return;
    }

    this.logger.info('Scheduling task', {
      taskId: task.id,
      name: task.name,
      cronExpression: task.cronExpression
    });

    const job = cron.schedule(task.cronExpression, async () => {
      await this.executeTask(task.id);
    });

    this.scheduledJobs.set(task.id, job);
  }

  async executeTask(taskId: string): Promise<void> {
    const task = store.scheduledTasksStore().findById(taskId);
    if (!task) {
      throw new NotFoundError('ScheduledTask', taskId);
    }

    const definition = this.taskDefinitions.get(task.name);
    if (!definition) {
      throw new TaskExecutionError(`No handler defined for task: ${task.name}`);
    }

    const attemptNumber = task.retryCount + 1;
    this.logger.info('Executing task', {
      taskId,
      taskName: task.name,
      attemptNumber
    });

    const executionLog = store.taskExecutionLogsStore().create({
      taskId: task.id,
      taskName: task.name,
      startedAt: new Date(),
      completedAt: null,
      status: 'RUNNING',
      attemptNumber,
      errorMessage: null,
      executionDurationMs: null,
      nextRetryAt: null
    });

    store.scheduledTasksStore().update(taskId, {
      lastRunAt: new Date(),
      lastRunStatus: 'RUNNING'
    });

    try {
      await definition.handler();

      const completedAt = new Date();
      const duration = differenceInMilliseconds(completedAt, executionLog.startedAt);

      store.taskExecutionLogsStore().update(executionLog.id, {
        completedAt,
        status: 'SUCCESS',
        executionDurationMs: duration
      });

      store.scheduledTasksStore().update(taskId, {
        lastRunStatus: 'SUCCESS',
        retryCount: 0
      });

      this.logger.info('Task executed successfully', {
        taskId,
        taskName: task.name,
        durationMs: duration
      });

    } catch (error) {
      await this.handleTaskFailure(
        task,
        executionLog,
        definition,
        error as Error,
        attemptNumber
      );
    }
  }

  private async handleTaskFailure(
    task: ScheduledTask,
    executionLog: TaskExecutionLog,
    definition: TaskDefinition,
    error: Error,
    attemptNumber: number
  ): Promise<void> {
    const completedAt = new Date();
    const duration = differenceInMilliseconds(completedAt, executionLog.startedAt);

    const maxRetries = task.maxRetries;
    const shouldRetry = attemptNumber <= maxRetries;
    const retryDelayMinutes = definition.retryDelayMinutes ?? 30;

    let nextRetryAt: Date | null = null;
    let newStatus: TaskRunStatus = 'FAILED';
    let newRetryCount = task.retryCount + 1;

    if (shouldRetry) {
      nextRetryAt = addMinutes(new Date(), retryDelayMinutes);
      newStatus = 'RETRYING';
      this.logger.warn('Task failed, scheduling retry', {
        taskId: task.id,
        taskName: task.name,
        attemptNumber,
        maxRetries,
        nextRetryAt: nextRetryAt.toISOString()
      });

      setTimeout(() => {
        this.executeTask(task.id).catch(err => {
          this.logger.error('Retry execution failed', err as Error, { taskId: task.id });
        });
      }, retryDelayMinutes * 60 * 1000);

    } else {
      this.logger.error('Task failed, max retries reached', error, {
        taskId: task.id,
        taskName: task.name,
        attemptNumber,
        maxRetries
      });
    }

    store.taskExecutionLogsStore().update(executionLog.id, {
      completedAt,
      status: newStatus,
      errorMessage: error.message,
      executionDurationMs: duration,
      nextRetryAt
    });

    store.scheduledTasksStore().update(task.id, {
      lastRunStatus: newStatus,
      retryCount: newRetryCount
    });
  }

  async runTaskManually(taskName: string): Promise<void> {
    this.logger.info('Running task manually', { taskName });

    const task = store.scheduledTasksStore().findByName(taskName);
    if (!task) {
      throw new NotFoundError('ScheduledTask', taskName);
    }

    await this.executeTask(task.id);
  }

  async enableTask(taskName: string): Promise<void> {
    this.logger.info('Enabling task', { taskName });

    const task = store.scheduledTasksStore().findByName(taskName);
    if (!task) {
      throw new NotFoundError('ScheduledTask', taskName);
    }

    store.scheduledTasksStore().update(task.id, { isEnabled: true });

    if (this.isStarted) {
      this.scheduleTask(task);
    }
  }

  async disableTask(taskName: string): Promise<void> {
    this.logger.info('Disabling task', { taskName });

    const task = store.scheduledTasksStore().findByName(taskName);
    if (!task) {
      throw new NotFoundError('ScheduledTask', taskName);
    }

    store.scheduledTasksStore().update(task.id, { isEnabled: false });

    const job = this.scheduledJobs.get(task.id);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(task.id);
    }
  }

  getTaskStatus(taskName: string): {
    task: ScheduledTask | undefined;
    recentLogs: TaskExecutionLog[];
  } {
    const task = store.scheduledTasksStore().findByName(taskName);
    const recentLogs = task 
      ? store.taskExecutionLogsStore().findByTaskId(task.id).slice(0, 10)
      : [];

    return { task, recentLogs };
  }
}

export const taskScheduler = new TaskScheduler();

const autoApprovalContext: ApprovalContext = {
  processorId: 'system',
  processorName: '系统自动处理',
  isAutoProcessed: true
};

taskScheduler.registerTask({
  name: 'auto-process-plot-verification',
  cronExpression: '*/5 * * * *',
  maxRetries: 3,
  retryDelayMinutes: 15,
  enabled: true,
  handler: async () => {
    const logger = createLoggerContext();
    logger.info('Running auto plot verification task');

    const pendingRequisitions = store.requisitionsStore().findByStatus('PENDING_APPROVAL')
      .filter(r => r.currentStage === 'PLOT_VERIFICATION');

    for (const requisition of pendingRequisitions) {
      const result = await approvalFlowService.autoProcessPlotVerification(requisition.id);
      
      if (result.passed) {
        await approvalFlowService.processStage(
          requisition.id,
          'PLOT_VERIFICATION',
          'APPROVE',
          { ...autoApprovalContext, comments: '地块验证自动通过' }
        );
      } else {
        await approvalFlowService.processStage(
          requisition.id,
          'PLOT_VERIFICATION',
          'REJECT',
          { ...autoApprovalContext, comments: result.failures.join('; ') }
        );
      }
    }

    logger.info('Auto plot verification task completed', {
      processedCount: pendingRequisitions.length
    });
  }
});

taskScheduler.registerTask({
  name: 'auto-process-interval-check',
  cronExpression: '*/5 * * * *',
  maxRetries: 3,
  retryDelayMinutes: 15,
  enabled: true,
  handler: async () => {
    const logger = createLoggerContext();
    logger.info('Running auto interval check task');

    const approvingRequisitions = store.requisitionsStore().findByStatus('APPROVING')
      .filter(r => r.currentStage === 'INTERVAL_CHECK');

    for (const requisition of approvingRequisitions) {
      const result = await approvalFlowService.autoProcessIntervalCheck(requisition.id);
      
      if (result.passed) {
        await approvalFlowService.processStage(
          requisition.id,
          'INTERVAL_CHECK',
          'APPROVE',
          { 
            ...autoApprovalContext, 
            comments: result.warning.length > 0 
              ? `间隔期校验通过，警告: ${result.warning.join('; ')}` 
              : '间隔期校验自动通过' 
          }
        );
      } else {
        await approvalFlowService.processStage(
          requisition.id,
          'INTERVAL_CHECK',
          'REJECT',
          { ...autoApprovalContext, comments: result.violations.join('; ') }
        );
      }
    }

    logger.info('Auto interval check task completed', {
      processedCount: approvingRequisitions.length
    });
  }
});

taskScheduler.registerTask({
  name: 'auto-process-inventory-check',
  cronExpression: '*/5 * * * *',
  maxRetries: 3,
  retryDelayMinutes: 15,
  enabled: true,
  handler: async () => {
    const logger = createLoggerContext();
    logger.info('Running auto inventory check task');

    const approvingRequisitions = store.requisitionsStore().findByStatus('APPROVING')
      .filter(r => r.currentStage === 'INVENTORY_CHECK');

    for (const requisition of approvingRequisitions) {
      const result = await approvalFlowService.autoProcessInventoryCheck(requisition.id);
      
      if (result.passed) {
        await approvalFlowService.processStage(
          requisition.id,
          'INVENTORY_CHECK',
          'APPROVE',
          { ...autoApprovalContext, comments: '库存检查自动通过' }
        );
      } else {
        await approvalFlowService.processStage(
          requisition.id,
          'INVENTORY_CHECK',
          'REJECT',
          { ...autoApprovalContext, comments: result.shortfalls.join('; ') }
        );
      }
    }

    logger.info('Auto inventory check task completed', {
      processedCount: approvingRequisitions.length
    });
  }
});

taskScheduler.registerTask({
  name: 'generate-daily-ledger-summary',
  cronExpression: '0 2 * * *',
  maxRetries: 2,
  retryDelayMinutes: 60,
  enabled: true,
  handler: async () => {
    const logger = createLoggerContext();
    logger.info('Running daily ledger summary task');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const summary = await ledgerService.getSummary({
      start: yesterday,
      end: today
    });

    logger.info('Daily ledger summary generated', {
      date: yesterday.toISOString().slice(0, 10),
      totalRecords: summary.totalRecords,
      compliantCount: summary.compliantCount,
      nonCompliantCount: summary.nonCompliantCount,
      violationCount: summary.violationCount
    });
  }
});

taskScheduler.registerTask({
  name: 'check-expiring-pesticides',
  cronExpression: '0 8 * * *',
  maxRetries: 2,
  retryDelayMinutes: 120,
  enabled: true,
  handler: async () => {
    const logger = createLoggerContext();
    logger.info('Running expiring pesticides check task');

    const thirtyDaysFromNow = addHours(new Date(), 30 * 24);
    const inventories = store.inventoriesStore().findAll();
    
    const expiring = inventories.filter(inv => 
      inv.quantity > 0 && inv.expiryDate <= thirtyDaysFromNow
    );

    for (const inv of expiring) {
      logger.warn('Pesticide inventory expiring soon', {
        inventoryId: inv.id,
        batchNumber: inv.batchNumber,
        expiryDate: inv.expiryDate.toISOString(),
        remainingQuantity: inv.quantity
      });
    }

    logger.info('Expiring pesticides check completed', {
      expiringCount: expiring.length
    });
  }
});

export { TaskDefinition };
