import type { BatchExecution, BatchTask } from '@/types';

export class IdempotentExecutor {
  private executionHistory: Map<string, BatchExecution> = new Map();
  private maxRetries: number = 0;

  constructor(maxRetries: number = 0) {
    this.maxRetries = maxRetries;
  }

  async execute(
    task: BatchTask,
    operation: (onProgress: (progress: number) => void) => Promise<{ successCount: number; failCount: number; result: Record<string, any> }>,
    onProgress?: (progress: number) => void,
    onLog?: (log: string) => void
  ): Promise<BatchExecution> {
    const { idempotencyKey, id: taskId, isIdempotent, maxRuns } = task;

    const existing = this.executionHistory.get(idempotencyKey);
    
    if (existing && isIdempotent) {
      if (existing.status === 'running') {
        throw new Error(`任务正在执行中，请稍后再试。幂等键: ${idempotencyKey.substring(0, 16)}...`);
      }
      
      if (existing.status === 'completed') {
        const runCount = this.getRunCount(idempotencyKey);
        if (runCount >= maxRuns) {
          throw new Error(`任务已达到最大执行次数 ${maxRuns} 次，如需重新执行请修改幂等键。`);
        }
        
        const returnExecution = {
          ...existing,
          logs: [
            ...existing.logs,
            `[INFO] 使用幂等键返回历史执行结果，避免重复执行`,
            `[INFO] 本次为第 ${runCount + 1} 次请求，已执行 ${runCount} 次`
          ]
        };
        
        onLog?.(`[CACHE] 命中幂等缓存，返回历史结果`);
        return returnExecution;
      }
    }

    const execution: BatchExecution = {
      id: crypto.randomUUID(),
      taskId,
      idempotencyKey,
      status: 'running',
      progress: 0,
      successCount: 0,
      failCount: 0,
      logs: [
        `[START] 开始执行任务: ${task.name}`,
        `[INFO] 幂等键: ${idempotencyKey.substring(0, 16)}...`,
        `[INFO] 开始时间: ${new Date().toISOString()}`
      ],
      result: {},
      startTime: new Date().toISOString()
    };

    this.executionHistory.set(idempotencyKey, execution);
    onLog?.(`[START] 任务开始执行`);

    const handleProgress = (progress: number) => {
      execution.progress = Math.min(100, Math.max(0, progress));
      onProgress?.(execution.progress);
    };

    try {
      const opResult = await this.retryOperation(
        () => operation(handleProgress),
        this.maxRetries,
        onLog
      );
      
      execution.status = 'completed';
      execution.progress = 100;
      execution.successCount = opResult.successCount;
      execution.failCount = opResult.failCount;
      execution.result = opResult.result;
      execution.endTime = new Date().toISOString();
      
      execution.logs.push(`[END] 执行完成`);
      execution.logs.push(`[RESULT] 成功: ${opResult.successCount}, 失败: ${opResult.failCount}`);
      execution.logs.push(`[INFO] 结束时间: ${execution.endTime}`);
      
      onLog?.(`[END] 任务执行完成`);
      
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date().toISOString();
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      execution.logs.push(`[ERROR] 执行失败: ${errorMsg}`);
      execution.logs.push(`[INFO] 结束时间: ${execution.endTime}`);
      
      onLog?.(`[ERROR] 任务失败: ${errorMsg}`);
      
      throw error;
    }

    return execution;
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    onLog?: (log: string) => void
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          onLog?.(`[RETRY] 第 ${attempt} 次重试...`);
        }
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        onLog?.(`[WARN] 第 ${attempt + 1} 次尝试失败: ${lastError.message}`);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  private getRunCount(idempotencyKey: string): number {
    let count = 0;
    for (const key of this.executionHistory.keys()) {
      if (key.startsWith(idempotencyKey.substring(0, 32))) {
        count++;
      }
    }
    return count;
  }

  getExecution(idempotencyKey: string): BatchExecution | undefined {
    return this.executionHistory.get(idempotencyKey);
  }

  clearHistory(): void {
    this.executionHistory.clear();
  }

  getAllExecutions(): BatchExecution[] {
    return Array.from(this.executionHistory.values());
  }
}

export const idempotentExecutor = new IdempotentExecutor(2);
