export interface LogEntry {
  raw: string;
  lineNumber: number;
  timestamp?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  errorType?: string;
  errorMessage?: string;
  requestBody?: string;
  responseBody?: string;
  userId?: string;
  traceId?: string;
  duration?: number;
}

export interface ParsedLogEntry extends LogEntry {
  isValid: boolean;
  parseError?: string;
}

export interface ErrorSample {
  id: string;
  path: string;
  method: string;
  statusCode: number;
  errorType: string;
  errorMessage: string;
  timestamp: string;
  traceId: string;
  requestBody?: string;
  responseBody?: string;
  userId?: string;
  duration?: number;
  originalLine: number;
  originalRaw: string;
}

export interface ErrorGroup {
  path: string;
  method: string;
  statusCode: number;
  errorType: string;
  count: number;
  samples: ErrorSample[];
}

export interface SamplingConfig {
  maxSamplesPerGroup: number;
  includeRequest: boolean;
  includeResponse: boolean;
  sensitiveFields: string[];
}

export interface ProcessingResult {
  summary: {
    totalLines: number;
    validEntries: number;
    invalidEntries: number;
    totalErrors: number;
    uniqueErrorGroups: number;
  };
  errorGroups: ErrorGroup[];
  invalidEntries: ParsedLogEntry[];
  config: SamplingConfig;
  generatedAt: string;
}

export interface CLIOutput {
  terminalSummary: string;
  jsonResult: ProcessingResult;
  markdownReport: string;
}
