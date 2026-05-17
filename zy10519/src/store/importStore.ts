import { v4 as uuidv4 } from 'uuid';
import {
  ImportTask,
  FileChunk,
  SuccessDetail,
  FailureDetail,
  ResumeSummary,
  ImportStatus,
  ChunkStatus
} from '../types/models';

export class ImportStore {
  private tasks: Map<string, ImportTask> = new Map();
  private chunks: Map<string, FileChunk> = new Map();
  private successDetails: Map<string, SuccessDetail> = new Map();
  private failureDetails: Map<string, FailureDetail> = new Map();

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
    const taskId = uuidv4();
    const totalChunks = Math.ceil(totalRows / chunkSize);
    
    const task: ImportTask = {
      taskId,
      fileName,
      fileSize,
      fileType,
      totalRows,
      totalChunks,
      chunkSize,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      businessType,
      description
    };

    this.tasks.set(taskId, task);

    for (let i = 0; i < totalChunks; i++) {
      const startRow = i * chunkSize + 1;
      const endRow = Math.min((i + 1) * chunkSize, totalRows);
      
      const chunk: FileChunk = {
        chunkId: uuidv4(),
        taskId,
        chunkIndex: i,
        startRow,
        endRow,
        status: 'PENDING',
        retryCount: 0
      };
      
      this.chunks.set(chunk.chunkId, chunk);
    }

    return task;
  }

  getTask(taskId: string): ImportTask | undefined {
    return this.tasks.get(taskId);
  }

  updateTaskStatus(taskId: string, status: ImportStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
    }
  }

  getTaskChunks(taskId: string): FileChunk[] {
    return Array.from(this.chunks.values())
      .filter(chunk => chunk.taskId === taskId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  updateChunkStatus(chunkId: string, status: ChunkStatus): void {
    const chunk = this.chunks.get(chunkId);
    if (chunk) {
      chunk.status = status;
      if (status === 'UPLOADED') {
        chunk.uploadTime = new Date();
      } else if (status === 'PROCESSING') {
        chunk.processStartTime = new Date();
      } else if (status === 'SUCCESS' || status === 'FAILED') {
        chunk.processEndTime = new Date();
      }
      chunk.status = status;
    }
  }

  incrementChunkRetry(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (chunk) {
      chunk.retryCount++;
    }
  }

  addSuccessDetail(
    taskId: string,
    chunkId: string,
    rowNumber: number,
    businessKey: string,
    rawData: string,
    recordId?: string
  ): SuccessDetail {
    const successDetail: SuccessDetail = {
      taskId,
      chunkId,
      rowNumber,
      businessKey,
      processedAt: new Date(),
      recordId,
      rawData
    };
    const key = `${taskId}-${rowNumber}`;
    this.successDetails.set(key, successDetail);
    return successDetail;
  }

  hasRowProcessed(taskId: string, rowNumber: number): boolean {
    const key = `${taskId}-${rowNumber}`;
    return this.successDetails.has(key) || this.failureDetails.has(key);
  }

  addFailureDetail(
    taskId: string,
    chunkId: string,
    rowNumber: number,
    businessKey: string,
    errorCode: string,
    errorMessage: string,
    rawData: string,
    stackTrace?: string
  ): FailureDetail {
    const failureDetail: FailureDetail = {
      taskId,
      chunkId,
      rowNumber,
      businessKey,
      errorCode,
      errorMessage,
      failedAt: new Date(),
      rawData,
      stackTrace,
      isManualFixed: false
    };
    const key = `${taskId}-${rowNumber}`;
    this.failureDetails.set(key, failureDetail);
    return failureDetail;
  }

  getSuccessDetails(taskId: string): SuccessDetail[] {
    return Array.from(this.successDetails.values())
      .filter(d => d.taskId === taskId)
      .sort((a, b) => a.rowNumber - b.rowNumber);
  }

  getFailureDetails(taskId: string): FailureDetail[] {
    return Array.from(this.failureDetails.values())
      .filter(d => d.taskId === taskId)
      .sort((a, b) => a.rowNumber - b.rowNumber);
  }

  manualFixFailure(
    taskId: string,
    rowNumber: number,
    fixedBy: string,
    fixNote: string
  ): FailureDetail | undefined {
    const key = `${taskId}-${rowNumber}`;
    const failure = this.failureDetails.get(key);
    if (failure) {
      failure.isManualFixed = true;
      failure.fixedBy = fixedBy;
      failure.fixedAt = new Date();
      failure.fixNote = fixNote;
      return failure;
    }
    return undefined;
  }

  getResumeSummary(taskId: string): ResumeSummary | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const chunks = this.getTaskChunks(taskId);
    const successRows = this.getSuccessDetails(taskId);
    const failureRows = this.getFailureDetails(taskId);

    const lastProcessedChunk = Math.max(
      ...chunks.filter(c => c.status !== 'PENDING').map(c => c.chunkIndex),
      -1
    );

    const lastSuccessfulRow = successRows.length > 0 
      ? Math.max(...successRows.map(s => s.rowNumber))
      : 0;

    const pendingChunks = chunks
      .filter(c => c.status === 'PENDING')
      .map(c => c.chunkIndex);

    const failedChunks = chunks
      .filter(c => c.status === 'FAILED')
      .map(c => c.chunkIndex);

    const canResume = task.status !== 'SUCCESS' && task.status !== 'PENDING';
    const resumeFromRow = lastSuccessfulRow + 1;

    return {
      taskId,
      lastProcessedChunk,
      lastSuccessfulRow,
      totalSuccessRows: successRows.length,
      totalFailedRows: failureRows.length,
      pendingChunks,
      failedChunks,
      canResume,
      resumeFromRow,
      estimatedRemainingRows: task.totalRows - lastSuccessfulRow
    };
  }

  getAllTasks(): ImportTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const importStore = new ImportStore();
