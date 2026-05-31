import { BatchTask, Warning } from '../types';
import { generateIdempotencyKey, checkDuplicateOperation, saveIdempotencyRecord, updateIdempotencyStatus } from '../utils/idempotency';
import { generateMockWarningDetail } from './mockData';

export interface BatchResult {
  success: boolean;
  message: string;
  processedCount: number;
  skippedCount: number;
  results: {
    warningId: string;
    status: 'success' | 'skipped' | 'failed';
    message: string;
  }[];
}

const tasks: Map<string, BatchTask> = new Map();

export function createBatchTask(operationType: string, warningIds: string[]): BatchTask | null {
  const duplicate = checkDuplicateOperation(operationType, warningIds);
  if (duplicate) {
    return null;
  }

  const task: BatchTask = {
    id: `batch_${Date.now()}`,
    idempotencyKey: generateIdempotencyKey(operationType, warningIds),
    warningIds: [...warningIds],
    status: 'pending',
    processedCount: 0,
    totalCount: warningIds.length,
    createdAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);

  saveIdempotencyRecord({
    key: task.idempotencyKey,
    warningIds: task.warningIds,
    status: 'processing',
    createdAt: task.createdAt,
  });

  return task;
}

export async function executeBatchAnalysis(
  warnings: Warning[],
  onProgress?: (processed: number, total: number) => void
): Promise<BatchResult> {
  const warningIds = warnings.map(w => w.id);
  
  const existingTask = createBatchTask('analysis', warningIds);
  if (!existingTask) {
    return {
      success: false,
      message: '检测到重复操作，已自动跳过。5分钟内相同数据无需重复分析。',
      processedCount: 0,
      skippedCount: warnings.length,
      results: warnings.map(w => ({
        warningId: w.id,
        status: 'skipped',
        message: '已处理，自动跳过',
      })),
    };
  }

  const task = existingTask;
  task.status = 'processing';
  tasks.set(task.id, task);

  const results: BatchResult['results'] = [];
  let processedCount = 0;

  for (const warning of warnings) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const duplicate = checkDuplicateOperation('analysis', [warning.id]);
      if (duplicate) {
        results.push({
          warningId: warning.id,
          status: 'skipped',
          message: '已处理，自动跳过',
        });
      } else {
        const detail = generateMockWarningDetail(warning);
        results.push({
          warningId: warning.id,
          status: 'success',
          message: detail.faultJudgment.isAbnormal ? '存在异常，需复核' : '分析完成，数据正常',
        });
        
        const key = generateIdempotencyKey('analysis', [warning.id]);
        saveIdempotencyRecord({
          key,
          warningIds: [warning.id],
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      }

      processedCount++;
      task.processedCount = processedCount;
      tasks.set(task.id, task);
      
      if (onProgress) {
        onProgress(processedCount, warnings.length);
      }
    } catch (error) {
      results.push({
        warningId: warning.id,
        status: 'failed',
        message: error instanceof Error ? error.message : '处理失败',
      });
    }
  }

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  tasks.set(task.id, task);

  updateIdempotencyStatus(task.idempotencyKey, 'completed', { results });

  const successCount = results.filter(r => r.status === 'success').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  return {
    success: true,
    message: `批量分析完成：成功 ${successCount} 条，跳过 ${skippedCount} 条`,
    processedCount: successCount,
    skippedCount,
    results,
  };
}

export async function executeBatchConfirm(
  warningIds: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<BatchResult> {
  const existingTask = createBatchTask('confirm', warningIds);
  if (!existingTask) {
    return {
      success: false,
      message: '检测到重复确认操作，已自动跳过。',
      processedCount: 0,
      skippedCount: warningIds.length,
      results: warningIds.map(id => ({
        warningId: id,
        status: 'skipped',
        message: '已确认，自动跳过',
      })),
    };
  }

  const results: BatchResult['results'] = [];
  
  for (let i = 0; i < warningIds.length; i++) {
    const warningId = warningIds[i];
    
    const duplicate = checkDuplicateOperation('confirm', [warningId]);
    if (duplicate) {
      results.push({
        warningId,
        status: 'skipped',
        message: '已确认，自动跳过',
      });
    } else {
      results.push({
        warningId,
        status: 'success',
        message: '已确认',
      });
      
      const key = generateIdempotencyKey('confirm', [warningId]);
      saveIdempotencyRecord({
        key,
        warningIds: [warningId],
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    }

    if (onProgress) {
      onProgress(i + 1, warningIds.length);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  updateIdempotencyStatus(existingTask.idempotencyKey, 'completed', { results });

  const successCount = results.filter(r => r.status === 'success').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  return {
    success: true,
    message: `批量确认完成：成功 ${successCount} 条，跳过 ${skippedCount} 条`,
    processedCount: successCount,
    skippedCount,
    results,
  };
}

export function getBatchTask(taskId: string): BatchTask | undefined {
  return tasks.get(taskId);
}

export function clearCompletedTasks(): void {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  for (const [id, task] of tasks.entries()) {
    if (task.completedAt && new Date(task.completedAt).getTime() < oneHourAgo) {
      tasks.delete(id);
    }
  }
}
