export interface LogTopicInput {
  topic: string;
  dailySizeGB: number;
  retentionDays: number;
  compressionRatio: number;
  costTag: string;
  originalLineNumber: number;
}

export interface ValidLogTopic extends LogTopicInput {
  compressedDailySizeGB: number;
  totalSizeGB: number;
  totalSizeTB: number;
  estimatedCost: number;
}

export interface InvalidLogTopic {
  topic: string;
  dailySizeGB: string;
  retentionDays: string;
  compressionRatio: string;
  costTag: string;
  originalLineNumber: number;
  errorReason: string;
}

export interface EstimationResult {
  summary: {
    totalTopics: number;
    validTopics: number;
    invalidTopics: number;
    totalDailySizeGB: number;
    totalCompressedDailySizeGB: number;
    totalRetentionGB: number;
    totalRetentionTB: number;
    totalEstimatedCost: number;
  };
  validTopics: ValidLogTopic[];
  invalidTopics: InvalidLogTopic[];
  groupedByCostTag: Record<string, {
    topics: ValidLogTopic[];
    totalRetentionTB: number;
    totalEstimatedCost: number;
  }>;
  topLargestTopics: ValidLogTopic[];
  generatedAt: string;
  parameters: {
    inputFile: string;
    costPerTBMonth?: number;
  };
}

export interface CLIOutput {
  terminalSummary: string;
  jsonResult: EstimationResult;
  markdownReport: string;
}