export interface FieldUsage {
  fieldName: string;
  typeName: string;
  fullPath: string;
  count: number;
  clients: Record<string, number>;
}

export interface QuerySample {
  query: string;
  clientTag?: string;
  source?: string;
  lineNumber?: number;
}

export interface AnalysisResult {
  fieldUsage: FieldUsage[];
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  errors: AnalysisError[];
  clientStats: Record<string, number>;
}

export interface AnalysisError {
  message: string;
  source?: string;
  lineNumber?: number;
  rawContent?: string;
  query?: string;
}

export interface CLIOptions {
  schema: string;
  queries: string;
  output?: string;
  format?: 'json' | 'markdown' | 'both';
  clientTagPattern?: string;
  selfTest?: boolean;
}
