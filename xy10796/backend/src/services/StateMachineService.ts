import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { logger } from '../config/logger';

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
  RETRYING = 'retrying',
}

export enum RecordStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum RollbackStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVIEWED = 'reviewed',
}

export class StateMachineService {
  private static validTransitions: Map<TaskStatus, TaskStatus[]> = new Map([
    [TaskStatus.PENDING, [TaskStatus.PROCESSING]],
    [TaskStatus.PROCESSING, [TaskStatus.SUCCESS, TaskStatus.FAILED]],
    [TaskStatus.SUCCESS, [TaskStatus.ROLLING_BACK]],
    [TaskStatus.FAILED, [TaskStatus.ROLLING_BACK, TaskStatus.RETRYING]],
    [TaskStatus.ROLLING_BACK, [TaskStatus.ROLLED_BACK]],
    [TaskStatus.ROLLED_BACK, [TaskStatus.RETRYING]],
    [TaskStatus.RETRYING, [TaskStatus.PROCESSING]],
  ]);

  static canTransition(currentStatus: TaskStatus, nextStatus: TaskStatus): boolean {
    const allowedNext = this.validTransitions.get(currentStatus);
    return allowedNext ? allowedNext.includes(nextStatus) : false;
  }

  static async transitionTask(taskId: string, nextStatus: TaskStatus): Promise<void> {
    await db.read();
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!this.canTransition(task.status as TaskStatus, nextStatus)) {
      throw new Error(`Invalid transition from ${task.status} to ${nextStatus}`);
    }

    task.status = nextStatus;
    task.updatedAt = new Date().toISOString();
    await db.write();
    logger.info(`Task ${taskId} transitioned to ${nextStatus}`);
  }

  static async processTask(taskId: string): Promise<void> {
    try {
      await db.read();
      let task = db.data.tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');

      await this.transitionTask(taskId, TaskStatus.PROCESSING);
      
      await db.read();
      task = db.data.tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');
      task.startedAt = new Date().toISOString();
      await db.write();

      const dataset = db.data.datasets.find(d => d.id === task.datasetId);
      if (!dataset) throw new Error('Dataset not found');

      const mockRecords = this.generateMockRecords(dataset.recordCount || 100);
      
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < mockRecords.length; i++) {
        try {
          const record = mockRecords[i];
          db.data.seedRecords.push({
            id: uuidv4(),
            taskId,
            recordId: record.id,
            recordData: record.data,
            status: RecordStatus.SUCCESS,
            importedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          successCount++;
        } catch (error) {
          failCount++;
          logger.error(`Failed to import record ${i}: ${error}`);
        }
      }

      task.totalRecords = mockRecords.length;
      task.successRecords = successCount;
      task.failedRecords = failCount;
      task.completedAt = new Date().toISOString();

      const finalStatus = failCount === 0 ? TaskStatus.SUCCESS : TaskStatus.FAILED;
      await db.write();
      await this.transitionTask(taskId, finalStatus);
      
      logger.info(`Task ${taskId} completed with ${successCount} success, ${failCount} failed`);
    } catch (error) {
      await db.read();
      const errorTask = db.data.tasks.find(t => t.id === taskId);
      if (errorTask) {
        errorTask.errorMessage = (error as Error).message;
        await db.write();
      }
      try {
        await this.transitionTask(taskId, TaskStatus.FAILED);
      } catch (transitionError) {
        logger.error(`Transition failed for task ${taskId}: ${transitionError}`);
      }
      logger.error(`Task ${taskId} failed: ${error}`);
    }
  }

  static async rollbackTask(taskId: string, reason: string): Promise<void> {
    try {
      await db.read();
      const task = db.data.tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');

      const rollbackRecordId = uuidv4();
      db.data.rollbackRecords.push({
        id: rollbackRecordId,
        taskId,
        reason,
        status: RollbackStatus.IN_PROGRESS,
        rolledBackRecords: 0,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await db.write();

      await this.transitionTask(taskId, TaskStatus.ROLLING_BACK);

      await db.read();
      const records = db.data.seedRecords.filter(r => r.taskId === taskId);
      
      let rolledBackCount = 0;
      for (const record of records) {
        record.status = RecordStatus.ROLLED_BACK;
        record.rolledBackAt = new Date().toISOString();
        record.updatedAt = new Date().toISOString();
        rolledBackCount++;
      }

      const rollback = db.data.rollbackRecords.find(r => r.id === rollbackRecordId);
      if (rollback) {
        rollback.rolledBackRecords = rolledBackCount;
        rollback.status = RollbackStatus.PENDING;
        rollback.completedAt = new Date().toISOString();
        rollback.updatedAt = new Date().toISOString();
      }

      await db.write();
      await this.transitionTask(taskId, TaskStatus.ROLLED_BACK);
      
      logger.info(`Task ${taskId} rolled back successfully`);
    } catch (error) {
      logger.error(`Rollback failed for task ${taskId}: ${error}`);
      throw error;
    }
  }

  static async retryTask(taskId: string): Promise<void> {
    await db.read();
    let task = db.data.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    if (task.retryCount >= task.maxRetries) {
      throw new Error('Max retry limit reached');
    }

    task.retryCount = task.retryCount + 1;
    await db.write();
    await this.transitionTask(taskId, TaskStatus.RETRYING);
    
    setTimeout(() => this.processTask(taskId), 1000);
  }

  private static generateMockRecords(count: number): Array<{ id: string; data: Record<string, any> }> {
    return Array.from({ length: count }, (_, i) => ({
      id: `record_${Date.now()}_${i}`,
      data: {
        index: i,
        name: `Test Record ${i + 1}`,
        value: Math.random() * 1000,
        createdAt: new Date().toISOString(),
      },
    }));
  }
}
