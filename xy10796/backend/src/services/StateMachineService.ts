import { SeedTask, TaskStatus, SeedRecord, RecordStatus, RollbackRecord, RollbackStatus, DatasetVersion } from '../models';
import { logger } from '../config/logger';
import { sequelize } from '../config/database';

export class StateMachineService {
  private static validTransitions: Map<TaskStatus, TaskStatus[]> = new Map([
    [TaskStatus.PENDING, [TaskStatus.PROCESSING]],
    [TaskStatus.PROCESSING, [TaskStatus.SUCCESS, TaskStatus.FAILED]],
    [TaskStatus.FAILED, [TaskStatus.ROLLING_BACK, TaskStatus.RETRYING]],
    [TaskStatus.ROLLING_BACK, [TaskStatus.ROLLED_BACK]],
    [TaskStatus.ROLLED_BACK, [TaskStatus.RETRYING]],
    [TaskStatus.RETRYING, [TaskStatus.PROCESSING]],
  ]);

  static canTransition(currentStatus: TaskStatus, nextStatus: TaskStatus): boolean {
    const allowedNext = this.validTransitions.get(currentStatus);
    return allowedNext ? allowedNext.includes(nextStatus) : false;
  }

  static async transitionTask(taskId: string, nextStatus: TaskStatus, metadata?: any): Promise<SeedTask> {
    const task = await SeedTask.findByPk(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!this.canTransition(task.status, nextStatus)) {
      throw new Error(`Invalid transition from ${task.status} to ${nextStatus}`);
    }

    await task.update({ status: nextStatus, metadata });
    logger.info(`Task ${taskId} transitioned to ${nextStatus}`);
    return task;
  }

  static async processTask(taskId: string): Promise<void> {
    const t = await sequelize.transaction();
    
    try {
      const task = await SeedTask.findByPk(taskId, { transaction: t });
      if (!task) throw new Error('Task not found');

      await this.transitionTask(taskId, TaskStatus.PROCESSING);
      await task.update({ startedAt: new Date() }, { transaction: t });

      const dataset = await DatasetVersion.findByPk(task.datasetVersionId);
      if (!dataset) throw new Error('Dataset not found');

      const mockRecords = this.generateMockRecords(dataset.recordCount || 100);
      
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < mockRecords.length; i++) {
        try {
          const record = mockRecords[i];
          await SeedRecord.create(
            {
              taskId,
              recordId: record.id,
              recordData: record.data,
              status: RecordStatus.SUCCESS,
              importedAt: new Date(),
            },
            { transaction: t }
          );
          successCount++;
        } catch (error) {
          failCount++;
          logger.error(`Failed to import record ${i}: ${error}`);
        }
      }

      await task.update(
        {
          totalRecords: mockRecords.length,
          successRecords: successCount,
          failedRecords: failCount,
          completedAt: new Date(),
        },
        { transaction: t }
      );

      const finalStatus = failCount === 0 ? TaskStatus.SUCCESS : TaskStatus.FAILED;
      await this.transitionTask(taskId, finalStatus);
      await t.commit();
      
      logger.info(`Task ${taskId} completed with ${successCount} success, ${failCount} failed`);
    } catch (error) {
      await t.rollback();
      await task.update({ errorMessage: (error as Error).message });
      await this.transitionTask(taskId, TaskStatus.FAILED);
      logger.error(`Task ${taskId} failed: ${error}`);
    }
  }

  static async rollbackTask(taskId: string, reason: string): Promise<void> {
    const t = await sequelize.transaction();
    
    try {
      const task = await SeedTask.findByPk(taskId, { transaction: t });
      if (!task) throw new Error('Task not found');

      const rollbackRecord = await RollbackRecord.create(
        {
          taskId,
          reason,
          status: RollbackStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
        { transaction: t }
      );

      await this.transitionTask(taskId, TaskStatus.ROLLING_BACK);

      const records = await SeedRecord.findAll({ where: { taskId }, transaction: t });
      
      let rolledBackCount = 0;
      for (const record of records) {
        await record.update(
          { status: RecordStatus.ROLLED_BACK, rolledBackAt: new Date() },
          { transaction: t }
        );
        rolledBackCount++;
      }

      await rollbackRecord.update(
        {
          rolledBackRecords: rolledBackCount,
          status: RollbackStatus.COMPLETED,
          completedAt: new Date(),
        },
        { transaction: t }
      );

      await this.transitionTask(taskId, TaskStatus.ROLLED_BACK);
      await t.commit();
      
      logger.info(`Task ${taskId} rolled back successfully`);
    } catch (error) {
      await t.rollback();
      logger.error(`Rollback failed for task ${taskId}: ${error}`);
      throw error;
    }
  }

  static async retryTask(taskId: string): Promise<void> {
    const task = await SeedTask.findByPk(taskId);
    if (!task) throw new Error('Task not found');

    if (task.retryCount >= task.maxRetries) {
      throw new Error('Max retry limit reached');
    }

    await task.update({ retryCount: task.retryCount + 1 });
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
