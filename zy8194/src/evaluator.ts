import {
  QueryResult,
  EvaluationMetrics,
  EvalRules,
  IssueItem,
  EvaluationReport,
  KnowledgeChunk,
  QueryItem
} from './types';

export class Evaluator {
  private rules: EvalRules;

  constructor(rules: EvalRules) {
    this.rules = rules;
  }

  calculateTopKRecall(
    actualResults: { chunk: { id: string; document_id: string } }[],
    expectedChunks: string[],
    expectedDocuments: string[],
    k: number
  ): number {
    const topKResults = actualResults.slice(0, k);
    const retrievedIds = new Set(topKResults.map(r => r.chunk.id));
    const retrievedDocIds = new Set(topKResults.map(r => r.chunk.document_id));

    const totalExpected = expectedChunks.length + expectedDocuments.length;
    if (totalExpected === 0) return 0;

    let hits = 0;
    for (const chunkId of expectedChunks) {
      if (retrievedIds.has(chunkId)) {
        hits++;
      }
    }

    for (const docId of expectedDocuments) {
      if (retrievedDocIds.has(docId)) {
        hits++;
      }
    }

    return hits / totalExpected;
  }

  calculateMRR(
    actualResults: { chunk: { id: string; document_id: string } }[],
    expectedChunks: string[],
    expectedDocuments: string[]
  ): number {
    const expectedIds = new Set(expectedChunks);
    const expectedDocIds = new Set(expectedDocuments);

    for (let i = 0; i < actualResults.length; i++) {
      const result = actualResults[i];
      if (expectedIds.has(result.chunk.id) || expectedDocIds.has(result.chunk.document_id)) {
        return 1 / (i + 1);
      }
    }

    return 0;
  }

  calculateReferenceCoverage(
    actualResults: { chunk: { id: string; document_id: string } }[],
    expectedChunks: string[],
    expectedDocuments: string[]
  ): number {
    const retrievedIds = new Set(actualResults.map(r => r.chunk.id));
    const retrievedDocIds = new Set(actualResults.map(r => r.chunk.document_id));

    const allExpected = [...expectedChunks, ...expectedDocuments];
    if (allExpected.length === 0) return 0;

    let covered = 0;
    for (const chunkId of expectedChunks) {
      if (retrievedIds.has(chunkId)) {
        covered++;
      }
    }
    for (const docId of expectedDocuments) {
      if (retrievedDocIds.has(docId)) {
        covered++;
      }
    }

    return covered / allExpected.length;
  }

  calculateExpiredDocHits(
    actualResults: { chunk: { document_id: string; is_expired?: boolean } }[]
  ): number {
    const expiredDocIds = new Set(this.rules.expired_documents);
    let hits = 0;

    for (const result of actualResults) {
      const chunk = result.chunk;
      if (expiredDocIds.has(chunk.document_id) || chunk.is_expired) {
        hits++;
      }
    }

    return hits;
  }

  calculateQueryMetrics(queryResult: QueryResult): EvaluationMetrics {
    const topKRecall: Record<number, number> = {};
    const maxK = Math.max(...this.rules.top_k_values);

    for (const k of this.rules.top_k_values) {
      topKRecall[k] = this.calculateTopKRecall(
        queryResult.actual_results,
        queryResult.expected_chunks,
        queryResult.expected_documents,
        k
      );
    }

    const mrr = this.calculateMRR(
      queryResult.actual_results,
      queryResult.expected_chunks,
      queryResult.expected_documents
    );

    const referenceCoverage = this.calculateReferenceCoverage(
      queryResult.actual_results,
      queryResult.expected_chunks,
      queryResult.expected_documents
    );

    const expiredDocHits = this.calculateExpiredDocHits(queryResult.actual_results);

    const avgRecall = Object.values(topKRecall).reduce((a, b) => a + b, 0) / Object.values(topKRecall).length;

    const overallScore =
      mrr * this.rules.mrr_weight +
      avgRecall * this.rules.recall_weight +
      referenceCoverage * this.rules.coverage_weight;

    return {
      query_id: queryResult.query_id,
      top_k_recall: topKRecall,
      mrr,
      reference_coverage: referenceCoverage,
      expired_doc_hits: expiredDocHits,
      duplicate_chunk_risk: 0,
      overall_score: overallScore
    };
  }

  generateIssues(
    queryResults: QueryResult[],
    queryMetrics: EvaluationMetrics[],
    duplicateChunks: { chunk1: string; chunk2: string; similarity: number }[],
    queries: QueryItem[],
    expectedRefs: Map<string, { expected_chunks: string[]; expected_documents: string[] }>
  ): IssueItem[] {
    const issues: IssueItem[] = [];

    for (let i = 0; i < queryResults.length; i++) {
      const result = queryResults[i];
      const metrics = queryMetrics[i];

      const expectedRef = expectedRefs.get(result.query_id);
      if (!expectedRef || (expectedRef.expected_chunks.length === 0 && expectedRef.expected_documents.length === 0)) {
        issues.push({
          type: 'missing_expected_refs',
          query_id: result.query_id,
          severity: 'medium',
          message: `Query '${result.query_id}' has no expected references defined`,
          details: { query_id: result.query_id, query: result.query }
        });
      }

      if (metrics.overall_score < this.rules.minimum_acceptable_score) {
        issues.push({
          type: 'low_overall_score',
          query_id: result.query_id,
          severity: 'high',
          message: `Query '${result.query_id}' has low overall score: ${metrics.overall_score.toFixed(3)}`,
          details: {
            query_id: result.query_id,
            query: result.query,
            overall_score: metrics.overall_score,
            minimum: this.rules.minimum_acceptable_score
          }
        });
      }

      if (metrics.expired_doc_hits > 0) {
        issues.push({
          type: 'expired_doc_hit',
          query_id: result.query_id,
          severity: 'medium',
          message: `Query '${result.query_id}' retrieved ${metrics.expired_doc_hits} expired document(s)`,
          details: {
            query_id: result.query_id,
            expired_count: metrics.expired_doc_hits,
            expired_docs: this.rules.expired_documents
          }
        });
      }

      const hasExpected = expectedRef && (expectedRef.expected_chunks.length > 0 || expectedRef.expected_documents.length > 0);
      if (hasExpected && metrics.mrr === 0) {
        issues.push({
          type: 'no_relevant_result',
          query_id: result.query_id,
          severity: 'high',
          message: `Query '${result.query_id}' has no relevant results in top-K`,
          details: {
            query_id: result.query_id,
            query: result.query,
            expected_chunks: expectedRef?.expected_chunks,
            expected_documents: expectedRef?.expected_documents
          }
        });
      }
    }

    for (const dup of duplicateChunks) {
      issues.push({
        type: 'duplicate_chunk',
        chunk_id: dup.chunk1,
        severity: 'medium',
        message: `Chunks '${dup.chunk1}' and '${dup.chunk2}' are highly similar (${(dup.similarity * 100).toFixed(1)}%)`,
        details: {
          chunk1: dup.chunk1,
          chunk2: dup.chunk2,
          similarity: dup.similarity
        }
      });
    }

    return issues;
  }

  generateReport(
    chunks: KnowledgeChunk[],
    queries: QueryItem[],
    queryResults: QueryResult[],
    queryMetrics: EvaluationMetrics[],
    issues: IssueItem[],
    duplicateChunks: { chunk1: string; chunk2: string; similarity: number }[]
  ): EvaluationReport {
    const totalQueries = queryMetrics.length;
    
    const sumMRR = queryMetrics.reduce((sum, m) => sum + m.mrr, 0);
    const averageMRR = totalQueries > 0 ? sumMRR / totalQueries : 0;

    const averageRecall: Record<number, number> = {};
    for (const k of this.rules.top_k_values) {
      const sum = queryMetrics.reduce((sum, m) => sum + (m.top_k_recall[k] || 0), 0);
      averageRecall[k] = totalQueries > 0 ? sum / totalQueries : 0;
    }

    const sumCoverage = queryMetrics.reduce((sum, m) => sum + m.reference_coverage, 0);
    const averageCoverage = totalQueries > 0 ? sumCoverage / totalQueries : 0;

    const totalExpiredHits = queryMetrics.reduce((sum, m) => sum + m.expired_doc_hits, 0);

    const passCount = queryMetrics.filter(m => m.overall_score >= this.rules.minimum_acceptable_score).length;
    const passRate = totalQueries > 0 ? passCount / totalQueries : 0;

    return {
      summary: {
        total_queries: totalQueries,
        total_chunks: chunks.length,
        average_mrr: averageMRR,
        average_recall: averageRecall,
        average_coverage: averageCoverage,
        expired_doc_hit_count: totalExpiredHits,
        duplicate_chunk_count: duplicateChunks.length,
        overall_pass_rate: passRate
      },
      query_metrics: queryMetrics,
      issues,
      generated_at: new Date().toISOString(),
      rules_applied: this.rules
    };
  }
}
