export interface SearchIndexTask {
  id: string;
  indexName: string;
  shardId: number;
  startTime: string;
  endTime: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'retrying';
  retryCount: number;
  isLargeIndex: boolean;
  sourceFile: string;
  sourceLine: number;
}

export interface WindowConflict {
  type: 'overlap' | 'cross_day' | 'large_concurrent';
  task1: SearchIndexTask;
  task2: SearchIndexTask;
  description: string;
}

export interface TaskDelay {
  task: SearchIndexTask;
  expectedStartTime: string;
  actualStartTime: string;
  delayMinutes: number;
  description: string;
}

export interface CheckResult {
  windowConflicts: WindowConflict[];
  taskDelays: TaskDelay[];
  crossDayWindows: SearchIndexTask[];
  failedRetries: SearchIndexTask[];
  largeIndexConcurrent: SearchIndexTask[];
}

export interface ReportSummary {
  totalTasks: number;
  conflictCount: number;
  delayCount: number;
  crossDayCount: number;
  failedRetryCount: number;
  largeConcurrentCount: number;
  files: {
    path: string;
    description: string;
  }[];
}

export interface CheckOptions {
  inputFile: string;
  outputDir: string;
  logFile: string;
  reportFile: string;
  overwrite: boolean;
}
