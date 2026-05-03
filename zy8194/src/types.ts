export interface KnowledgeChunk {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
  is_expired?: boolean;
}

export interface QueryItem {
  id: string;
  query: string;
  query_embedding: number[];
  category?: string;
}

export interface ExpectedRef {
  query_id: string;
  expected_chunks: string[];
  expected_documents: string[];
  explanation?: string;
}

export interface EvalRules {
  top_k_values: number[];
  expired_documents: string[];
  duplicate_threshold: number;
  mrr_weight: number;
  recall_weight: number;
  coverage_weight: number;
  minimum_acceptable_score: number;
}

export interface SearchResult {
  chunk: KnowledgeChunk;
  score: number;
  rank: number;
}

export interface QueryResult {
  query_id: string;
  query: string;
  actual_results: SearchResult[];
  expected_chunks: string[];
  expected_documents: string[];
}

export interface EvaluationMetrics {
  query_id: string;
  top_k_recall: Record<number, number>;
  mrr: number;
  reference_coverage: number;
  expired_doc_hits: number;
  duplicate_chunk_risk: number;
  overall_score: number;
}

export interface IssueItem {
  type: string;
  query_id?: string;
  chunk_id?: string;
  document_id?: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  details?: Record<string, unknown>;
}

export interface EvaluationReport {
  summary: {
    total_queries: number;
    total_chunks: number;
    average_mrr: number;
    average_recall: Record<number, number>;
    average_coverage: number;
    expired_doc_hit_count: number;
    duplicate_chunk_count: number;
    overall_pass_rate: number;
  };
  query_metrics: EvaluationMetrics[];
  issues: IssueItem[];
  generated_at: string;
  rules_applied: EvalRules;
}

export interface CLIConfig {
  chunksPath: string;
  queriesPath: string;
  expectedPath: string;
  rulesPath: string;
  outputDir: string;
  topK?: number;
  verbose: boolean;
}
