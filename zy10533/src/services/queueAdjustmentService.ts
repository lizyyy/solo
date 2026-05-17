import { QueueAdjustmentDAO, AffectedTaskDAO, FailureRecordDAO } from '../database/dao';
import {
  QueueAdjustment,
  AffectedTask,
  FailureRecord,
  AdjustmentStatus,
  PriorityLevel,
  CreateAdjustmentRequest,
  ManualCorrectionRequest,
  AdjustmentReport
} from '../types';

const mockQueuePriorities: Record<string, PriorityLevel> = {
  'order-processing': PriorityLevel.NORMAL,
  'payment-queue': PriorityLevel.HIGH,
  'notification': PriorityLevel.LOW,
  'inventory-sync': PriorityLevel.NORMAL
};

export const QueueAdjustmentService = {
  async createAdjustment(request: CreateAdjustmentRequest): Promise<QueueAdjustment> {
    try {
      const existing = await QueueAdjustmentDAO.findByIdempotencyKey(request.idempotencyKey);
      if (existing) {
        return existing;
      }

      const originalPriority = mockQueuePriorities[request.queueName] || PriorityLevel.NORMAL;
      
      if (request.targetPriority === originalPriority) {
        throw new Error('目标优先级与当前优先级相同，无需调整');
      }

      const adjustment = await QueueAdjustmentDAO.create(request, originalPriority);
      
      const now = new Date();
      if (!request.scheduledAt || request.scheduledAt <= now) {
        await this.activateAdjustment(adjustment.id);
        return (await QueueAdjustmentDAO.findById(adjustment.id))!;
      }

      return adjustment;
    } catch (error: any) {
      await this.recordFailure(
        'temp-' + Date.now(),
        'createAdjustment',
        request,
        '基于幂等性检查和队列当前优先级创建调整记录',
        error
      );
      throw error;
    }
  },

  async activateAdjustment(adjustmentId: string): Promise<void> {
    try {
      const adjustment = await QueueAdjustmentDAO.findById(adjustmentId);
      if (!adjustment) {
        throw new Error('调整记录不存在');
      }
      if (adjustment.status !== AdjustmentStatus.PENDING) {
        throw new Error(`无法从状态 ${adjustment.status} 激活调整`);
      }

      const now = new Date();
      await QueueAdjustmentDAO.updateStatus(adjustmentId, AdjustmentStatus.ACTIVE, {
        activatedAt: now
      });

      await this.simulateAffectedTasks(adjustmentId);
    } catch (error: any) {
      await this.recordFailure(
        adjustmentId,
        'activateAdjustment',
        { adjustmentId },
        '检查状态合法性并更新为ACTIVE，同时记录影响任务',
        error
      );
      await QueueAdjustmentDAO.updateStatus(adjustmentId, AdjustmentStatus.FAILED);
      throw error;
    }
  },

  async simulateAffectedTasks(adjustmentId: string): Promise<void> {
    const adjustment = await QueueAdjustmentDAO.findById(adjustmentId);
    if (!adjustment) return;

    const taskTypes = ['order-create', 'payment-process', 'notification-send', 'inventory-update'];
    const taskCount = Math.floor(Math.random() * 50) + 10;

    for (let i = 0; i < taskCount; i++) {
      const task: Omit<AffectedTask, 'id'> = {
        adjustmentId,
        taskId: `task-${Date.now()}-${i}`,
        taskType: taskTypes[i % taskTypes.length],
        originalPriority: adjustment.originalPriority,
        adjustedPriority: adjustment.targetPriority,
        affectedAt: new Date(),
        metadata: { 
          source: 'auto-simulation',
          sequence: i,
          timestamp: Date.now()
        }
      };
      await AffectedTaskDAO.create(task);
    }
  },

  async startRecovery(adjustmentId: string): Promise<void> {
    try {
      const adjustment = await QueueAdjustmentDAO.findById(adjustmentId);
      if (!adjustment) {
        throw new Error('调整记录不存在');
      }
      if (adjustment.status !== AdjustmentStatus.ACTIVE) {
        throw new Error(`只有ACTIVE状态的调整可以开始恢复，当前状态: ${adjustment.status}`);
      }

      await QueueAdjustmentDAO.updateStatus(adjustmentId, AdjustmentStatus.RESTORING, {
        restoredAt: new Date()
      });

      const tasks = await AffectedTaskDAO.findByAdjustmentId(adjustmentId);
      for (const task of tasks) {
        if (!task.recoveredAt) {
          await AffectedTaskDAO.markRecovered(task.id);
        }
      }

      const report = await this.generateReport(adjustmentId);
      
      await QueueAdjustmentDAO.updateStatus(adjustmentId, AdjustmentStatus.COMPLETED, {
        completedAt: new Date(),
        report
      });
    } catch (error: any) {
      await this.recordFailure(
        adjustmentId,
        'startRecovery',
        { adjustmentId },
        '将所有受影响任务恢复原优先级并生成报告',
        error
      );
      await QueueAdjustmentDAO.updateStatus(adjustmentId, AdjustmentStatus.FAILED);
      throw error;
    }
  },

  async generateReport(adjustmentId: string): Promise<AdjustmentReport> {
    const tasks = await AffectedTaskDAO.findByAdjustmentId(adjustmentId);
    const taskDistribution: Record<string, number> = {};
    
    tasks.forEach(task => {
      taskDistribution[task.taskType] = (taskDistribution[task.taskType] || 0) + 1;
    });

    return {
      totalAffectedTasks: tasks.length,
      peakConcurrency: Math.floor(Math.random() * 20) + 5,
      avgProcessingTime: Math.floor(Math.random() * 500) + 100,
      taskDistribution,
      summary: `本次调整共影响 ${tasks.length} 个任务，已全部恢复原优先级。任务类型分布: ${JSON.stringify(taskDistribution)}`,
      generatedAt: new Date()
    };
  },

  async getAdjustmentById(id: string): Promise<QueueAdjustment | null> {
    return QueueAdjustmentDAO.findById(id);
  },

  async getAllAdjustments(filters?: { status?: AdjustmentStatus; queueName?: string }): Promise<QueueAdjustment[]> {
    return QueueAdjustmentDAO.findAll(filters);
  },

  async getAffectedTasks(adjustmentId: string): Promise<AffectedTask[]> {
    return AffectedTaskDAO.findByAdjustmentId(adjustmentId);
  },

  async getFailureRecords(adjustmentId: string): Promise<FailureRecord[]> {
    return FailureRecordDAO.findByAdjustmentId(adjustmentId);
  },

  async applyManualCorrection(request: ManualCorrectionRequest): Promise<void> {
    try {
      const adjustment = await QueueAdjustmentDAO.findById(request.adjustmentId);
      if (!adjustment) {
        throw new Error('调整记录不存在');
      }
      if (adjustment.status === AdjustmentStatus.COMPLETED || adjustment.status === AdjustmentStatus.CANCELLED) {
        throw new Error('已完成或已取消的调整无法修正');
      }

      await QueueAdjustmentDAO.updateManualCorrection(request.adjustmentId, {
        targetPriority: request.newPriority,
        recoveryCondition: request.newRecoveryCondition
      });
    } catch (error: any) {
      await this.recordFailure(
        request.adjustmentId,
        'applyManualCorrection',
        request,
        '人工修正调整的优先级或恢复条件',
        error
      );
      throw error;
    }
  },

  async cancelAdjustment(adjustmentId: string): Promise<void> {
    const adjustment = await QueueAdjustmentDAO.findById(adjustmentId);
    if (!adjustment) {
      throw new Error('调整记录不存在');
    }
    if (adjustment.status === AdjustmentStatus.ACTIVE) {
      throw new Error('ACTIVE状态的调整无法直接取消，请先执行恢复操作');
    }

    await QueueAdjustmentDAO.updateStatus(adjustmentId, AdjustmentStatus.CANCELLED);
  },

  async resolveFailure(failureId: string, conclusion: string): Promise<void> {
    await FailureRecordDAO.resolve(failureId, conclusion);
  },

  async recordFailure(
    adjustmentId: string,
    operation: string,
    originalInput: any,
    processingBasis: string,
    error: Error
  ): Promise<void> {
    await FailureRecordDAO.create({
      adjustmentId,
      operation,
      originalInput,
      processingBasis,
      errorMessage: error.message,
      errorStack: error.stack
    });
  },

  async getCurrentQueuePriority(queueName: string): Promise<PriorityLevel> {
    const activeAdjustments = await QueueAdjustmentDAO.findAll({
      status: AdjustmentStatus.ACTIVE,
      queueName
    });

    if (activeAdjustments.length > 0) {
      return Math.max(...activeAdjustments.map(a => a.targetPriority));
    }

    return mockQueuePriorities[queueName] || PriorityLevel.NORMAL;
  }
};
