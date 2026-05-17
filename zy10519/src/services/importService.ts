import { importStore } from '../store/importStore';
import {
  ImportTask,
  FileChunk,
  SuccessDetail,
  FailureDetail,
  ResumeSummary,
  BusinessExportData,
  ImportStatus
} from '../types/models';

export class ImportService {
  createTask(
    fileName: string,
    fileSize: number,
    fileType: string,
    totalRows: number,
    chunkSize: number,
    createdBy: string,
    businessType: string,
    description?: string
  ): ImportTask {
    return importStore.createTask(
      fileName,
      fileSize,
      fileType,
      totalRows,
      chunkSize,
      createdBy,
      businessType,
      description
    );
  }

  getTask(taskId: string): ImportTask | undefined {
    return importStore.getTask(taskId);
  }

  getAllTasks(): ImportTask[] {
    return importStore.getAllTasks();
  }

  getTaskChunks(taskId: string): FileChunk[] {
    return importStore.getTaskChunks(taskId);
  }

  startUpload(taskId: string): void {
    importStore.updateTaskStatus(taskId, 'UPLOADING');
  }

  startProcessing(taskId: string): void {
    importStore.updateTaskStatus(taskId, 'PROCESSING');
  }

  async processChunk(
    taskId: string,
    chunkId: string,
    processRowFn: (rowData: string, rowNumber: number) => Promise<{
      success: boolean;
      businessKey: string;
      recordId?: string;
      errorCode?: string;
      errorMessage?: string;
      stackTrace?: string;
    }>,
    rowsData: Array<{ rowNumber: number; rowData: string }>
  ): Promise<void> {
    const task = importStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    importStore.updateChunkStatus(chunkId, 'PROCESSING');

    let successCount = 0;
    let failureCount = 0;

    for (const { rowNumber, rowData } of rowsData) {
      if (importStore.hasRowProcessed(taskId, rowNumber)) {
        continue;
      }

      try {
        const result = await processRowFn(rowData, rowNumber);
        
        if (result.success) {
          importStore.addSuccessDetail(
            taskId,
            chunkId,
            rowNumber,
            result.businessKey,
            rowData,
            result.recordId
          );
          successCount++;
        } else {
          importStore.addFailureDetail(
            taskId,
            chunkId,
            rowNumber,
            result.businessKey,
            result.errorCode || 'UNKNOWN_ERROR',
            result.errorMessage || '未知错误',
            rowData,
            result.stackTrace
          );
          failureCount++;
        }
      } catch (error) {
        importStore.addFailureDetail(
          taskId,
          chunkId,
          rowNumber,
          '',
          'PROCESSING_EXCEPTION',
          error instanceof Error ? error.message : '处理异常',
          rowData,
          error instanceof Error ? error.stack : undefined
        );
        failureCount++;
      }
    }

    if (failureCount === 0) {
      importStore.updateChunkStatus(chunkId, 'SUCCESS');
      this.updateTaskStatusAfterChunk(taskId);
    } else {
      importStore.updateChunkStatus(chunkId, 'FAILED');
      importStore.updateTaskStatus(taskId, 'PARTIAL_SUCCESS');
    }
  }

  private updateTaskStatusAfterChunk(taskId: string): void {
    const chunks = importStore.getTaskChunks(taskId);
    const allSuccess = chunks.every(c => c.status === 'SUCCESS');
    const anyFailed = chunks.some(c => c.status === 'FAILED');
    const allProcessed = chunks.every(c => c.status === 'SUCCESS' || c.status === 'FAILED');

    if (allSuccess) {
      importStore.updateTaskStatus(taskId, 'SUCCESS');
    } else if (allProcessed && anyFailed) {
      importStore.updateTaskStatus(taskId, 'PARTIAL_SUCCESS');
    }
  }

  markTaskFailed(taskId: string): void {
    importStore.updateTaskStatus(taskId, 'FAILED');
  }

  markTaskNeedsManualFix(taskId: string): void {
    importStore.updateTaskStatus(taskId, 'NEEDS_MANUAL_FIX');
  }

  resumeTask(taskId: string): ResumeSummary {
    const summary = importStore.getResumeSummary(taskId);
    if (!summary) {
      throw new Error(`Task ${taskId} not found`);
    }

    importStore.updateTaskStatus(taskId, 'RESUMING');

    const chunks = importStore.getTaskChunks(taskId);
    chunks.forEach(chunk => {
      if (chunk.status === 'FAILED') {
        importStore.incrementChunkRetry(chunk.chunkId);
      }
    });

    return summary;
  }

  getResumeSummary(taskId: string): ResumeSummary | undefined {
    return importStore.getResumeSummary(taskId);
  }

  manualFixFailure(
    taskId: string,
    rowNumber: number,
    fixedBy: string,
    fixNote: string
  ): FailureDetail | undefined {
    const result = importStore.manualFixFailure(taskId, rowNumber, fixedBy, fixNote);
    
    const failures = importStore.getFailureDetails(taskId);
    const allFixed = failures.every(f => f.isManualFixed);
    if (allFixed) {
      const chunks = importStore.getTaskChunks(taskId);
      const allSuccess = chunks.every(c => c.status === 'SUCCESS');
      if (allSuccess) {
        importStore.updateTaskStatus(taskId, 'SUCCESS');
      }
    }

    return result;
  }

  getSuccessDetails(taskId: string): SuccessDetail[] {
    return importStore.getSuccessDetails(taskId);
  }

  getFailureDetails(taskId: string): FailureDetail[] {
    return importStore.getFailureDetails(taskId);
  }

  exportBusinessData(taskId: string): BusinessExportData {
    const task = importStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const summary = importStore.getResumeSummary(taskId)!;
    const successDetails = importStore.getSuccessDetails(taskId);
    const failureDetails = importStore.getFailureDetails(taskId);

    const statusMap: Record<ImportStatus, string> = {
      PENDING: '等待中',
      UPLOADING: '上传中',
      PROCESSING: '处理中',
      PARTIAL_SUCCESS: '部分成功',
      SUCCESS: '全部成功',
      FAILED: '处理失败',
      NEEDS_MANUAL_FIX: '需要人工修正',
      RESUMING: '续传中'
    };

    const progress = task.totalRows > 0 
      ? `${Math.round((summary.totalSuccessRows + summary.totalFailedRows) / task.totalRows * 100)}%`
      : '0%';

    return {
      taskSummary: {
        任务ID: task.taskId,
        文件名: task.fileName,
        业务类型: task.businessType,
        任务状态: statusMap[task.status],
        创建时间: task.createdAt.toLocaleString('zh-CN'),
        最后更新: task.updatedAt.toLocaleString('zh-CN'),
        总行数: task.totalRows,
        成功行数: summary.totalSuccessRows,
        失败行数: summary.totalFailedRows,
        完成进度: progress
      },
      successRecords: successDetails.map(s => ({
        行号: s.rowNumber,
        业务主键: s.businessKey,
        处理时间: s.processedAt.toLocaleString('zh-CN'),
        生成记录ID: s.recordId,
        原始数据: s.rawData
      })),
      failedRecords: failureDetails.map(f => ({
        行号: f.rowNumber,
        业务主键: f.businessKey,
        错误代码: f.errorCode,
        错误描述: f.errorMessage,
        失败时间: f.failedAt.toLocaleString('zh-CN'),
        是否已人工修正: f.isManualFixed ? '是' : '否',
        修正人: f.fixedBy,
        修正时间: f.fixedAt?.toLocaleString('zh-CN'),
        修正说明: f.fixNote,
        原始数据: f.rawData
      })),
      resumeGuide: {
        是否可续传: summary.canResume ? '是' : '否',
        续传起始行: summary.resumeFromRow,
        待处理分片: summary.pendingChunks.length > 0 
          ? summary.pendingChunks.map(i => `第${i + 1}片`).join('、')
          : '无',
        失败分片: summary.failedChunks.length > 0 
          ? summary.failedChunks.map(i => `第${i + 1}片`).join('、')
          : '无',
        剩余待处理行数: summary.estimatedRemainingRows,
        续传说明: summary.canResume 
          ? `可以从第 ${summary.resumeFromRow} 行开始续传，无需重复上传已成功的 ${summary.totalSuccessRows} 行数据`
          : '当前任务状态不支持续传，请确认任务是否已完成或未开始'
      }
    };
  }

  retryFailedChunk(taskId: string, chunkIndex: number): void {
    const chunks = importStore.getTaskChunks(taskId);
    const chunk = chunks.find(c => c.chunkIndex === chunkIndex);
    if (!chunk) {
      throw new Error(`Chunk ${chunkIndex} not found for task ${taskId}`);
    }

    importStore.updateChunkStatus(chunk.chunkId, 'PENDING');
    importStore.incrementChunkRetry(chunk.chunkId);
  }
}

export const importService = new ImportService();
