export interface JsonlRecord {
  [key: string]: any;
}

export interface BadRow {
  sourceFile: string;
  lineNumber: number;
  rawContent: string;
  error: string;
}

export interface ValidRow {
  sourceFile: string;
  lineNumber: number;
  record: JsonlRecord;
  sessionKey: string;
  eventTime: number;
  shardId?: number;
}

export interface GapInfo {
  sessionKey: string;
  gapStart: number;
  gapEnd: number;
  gapDuration: number;
  previousEventTime: number;
  nextEventTime: number;
  previousShard?: number;
  nextShard?: number;
}

export interface SessionEvents {
  sessionKey: string;
  events: ValidRow[];
  gaps: GapInfo[];
  shardIds: Set<number>;
}

export interface ProcessOptions {
  input: string;
  sessionKeyField: string;
  eventTimeField: string;
  shardIdField?: string;
  gapThresholdMs: number;
  outputDir: string;
  outputPrefix: string;
}

export interface ProcessingResult {
  options: ProcessOptions;
  startTime: Date;
  endTime: Date;
  totalFilesProcessed: number;
  totalRowsRead: number;
  validRows: number;
  badRows: number;
  uniqueSessions: number;
  totalGaps: number;
  outputFiles: {
    sortedJsonl: string;
    machineReadable: string;
    report: string;
    badRows: string;
  };
  badRowDetails: BadRow[];
  gapSummary: {
    totalGapDuration: number;
    avgGapDuration: number;
    maxGapDuration: number;
    gapsBySession: Map<string, number>;
  };
}
