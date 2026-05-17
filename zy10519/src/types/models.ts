export type ImportStatus = 
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'PARTIAL_SUCCESS'
  | 'SUCCESS'
  | 'FAILED'
  | 'NEEDS_MANUAL_FIX'
  | 'RESUMING';

export type ChunkStatus = 
  | 'PENDING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED';

export interface ImportTask {
  taskId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalRows: number;
  totalChunks: number;
  chunkSize: number;
  status: ImportStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  businessType: string;
  description?: string;
}

export interface FileChunk {
  chunkId: string;
  taskId: string;
  chunkIndex: number;
  startRow: number;
  endRow: number;
  status: ChunkStatus;
  uploadTime?: Date;
  processStartTime?: Date;
  processEndTime?: Date;
  retryCount: number;
  checksum?: string;
}

export interface RowRange {
  taskId: string;
  chunkId: string;
  startRow: number;
  endRow: number;
  totalRowsInRange: number;
}

export interface SuccessDetail {
  taskId: string;
  chunkId: string;
  rowNumber: number;
  businessKey: string;
  processedAt: Date;
  recordId?: string;
  rawData: string;
}

export interface FailureDetail {
  taskId: string;
  chunkId: string;
  rowNumber: number;
  businessKey: string;
  errorCode: string;
  errorMessage: string;
  failedAt: Date;
  rawData: string;
  stackTrace?: string;
  isManualFixed: boolean;
  fixedBy?: string;
  fixedAt?: Date;
  fixNote?: string;
}

export interface ResumeSummary {
  taskId: string;
  lastProcessedChunk: number;
  lastSuccessfulRow: number;
  totalSuccessRows: number;
  totalFailedRows: number;
  pendingChunks: number[];
  failedChunks: number[];
  canResume: boolean;
  resumeFromRow: number;
  estimatedRemainingRows: number;
}

export interface BusinessExportData {
  taskSummary: {
    任务ID: string;
    文件名: string;
    业务类型: string;
    任务状态: string;
    创建时间: string;
    最后更新: string;
    总行数: number;
    成功行数: number;
    失败行数: number;
    完成进度: string;
  };
  successRecords: Array<{
    行号: number;
    业务主键: string;
    处理时间: string;
    生成记录ID?: string;
    原始数据: string;
  }>;
  failedRecords: Array<{
    行号: number;
    业务主键: string;
    错误代码: string;
    错误描述: string;
    失败时间: string;
    是否已人工修正: string;
    修正人?: string;
    修正时间?: string;
    修正说明?: string;
    原始数据: string;
  }>;
  resumeGuide: {
    是否可续传: string;
    续传起始行: number;
    待处理分片: string;
    失败分片: string;
    剩余待处理行数: number;
    续传说明: string;
  };
}
