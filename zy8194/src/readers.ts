import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { parse } from 'csv-parse/sync';
import { KnowledgeChunk, QueryItem, ExpectedRef, EvalRules, IssueItem } from './types';

export class FileReader {
  static async readKnowledgeChunks(filePath: string): Promise<{ chunks: KnowledgeChunk[]; issues: IssueItem[] }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const chunks: KnowledgeChunk[] = [];
    const issues: IssueItem[] = [];
    const embeddingDimensions: Set<number> = new Set();

    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i];
        if (!line.trim()) continue;

        const chunk = JSON.parse(line) as KnowledgeChunk;
        
        if (!chunk.id) {
          issues.push({
            type: 'invalid_chunk',
            severity: 'high',
            message: `Line ${i + 1}: Chunk missing 'id' field`,
            details: { line: i + 1 }
          });
          continue;
        }

        if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
          issues.push({
            type: 'invalid_embedding',
            chunk_id: chunk.id,
            severity: 'high',
            message: `Chunk '${chunk.id}' has invalid or missing embedding`,
            details: { chunk_id: chunk.id }
          });
          continue;
        }

        embeddingDimensions.add(chunk.embedding.length);
        chunks.push(chunk);
      } catch (error) {
        issues.push({
          type: 'parse_error',
          severity: 'high',
          message: `Line ${i + 1}: Failed to parse JSON`,
          details: { line: i + 1, error: String(error) }
        });
      }
    }

    if (embeddingDimensions.size > 1) {
      issues.push({
        type: 'dimension_mismatch',
        severity: 'high',
        message: `Found inconsistent embedding dimensions: ${Array.from(embeddingDimensions).join(', ')}`,
        details: { dimensions: Array.from(embeddingDimensions) }
      });
    }

    return { chunks, issues };
  }

  static async readQueries(filePath: string): Promise<{ queries: QueryItem[]; issues: IssueItem[] }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const queries: QueryItem[] = [];
    const issues: IssueItem[] = [];
    const embeddingDimensions: Set<number> = new Set();

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as Record<string, string>;
      
      try {
        const queryItem: QueryItem = {
          id: record.id || record.query_id || `q-${i + 1}`,
          query: record.query || record.question || '',
          query_embedding: [],
          category: record.category
        };

        if (!queryItem.query) {
          issues.push({
            type: 'invalid_query',
            query_id: queryItem.id,
            severity: 'high',
            message: `Query at row ${i + 2} is missing 'query' field`,
            details: { row: i + 2 }
          });
          continue;
        }

        if (record.query_embedding) {
          try {
            queryItem.query_embedding = JSON.parse(record.query_embedding);
            if (!Array.isArray(queryItem.query_embedding)) {
              throw new Error('Embedding is not an array');
            }
            embeddingDimensions.add(queryItem.query_embedding.length);
          } catch (e) {
            issues.push({
              type: 'invalid_embedding',
              query_id: queryItem.id,
              severity: 'high',
              message: `Query '${queryItem.id}' has invalid query_embedding`,
              details: { query_id: queryItem.id, error: String(e) }
            });
            continue;
          }
        } else {
          issues.push({
            type: 'missing_embedding',
            query_id: queryItem.id,
            severity: 'medium',
            message: `Query '${queryItem.id}' is missing query_embedding`,
            details: { query_id: queryItem.id }
          });
          continue;
        }

        queries.push(queryItem);
      } catch (error) {
        issues.push({
          type: 'parse_error',
          severity: 'high',
          message: `Row ${i + 2}: Failed to parse query`,
          details: { row: i + 2, error: String(error) }
        });
      }
    }

    if (embeddingDimensions.size > 1) {
      issues.push({
        type: 'dimension_mismatch',
        severity: 'high',
        message: `Found inconsistent query embedding dimensions: ${Array.from(embeddingDimensions).join(', ')}`,
        details: { dimensions: Array.from(embeddingDimensions) }
      });
    }

    return { queries, issues };
  }

  static async readExpectedRefs(filePath: string): Promise<{ refs: Map<string, ExpectedRef>; issues: IssueItem[] }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.load(content) as { expected_refs: ExpectedRef[] } | ExpectedRef[];
    
    const refs = new Map<string, ExpectedRef>();
    const issues: IssueItem[] = [];

    let refList: ExpectedRef[] = [];
    if (Array.isArray(data)) {
      refList = data;
    } else if (data && 'expected_refs' in data && Array.isArray(data.expected_refs)) {
      refList = data.expected_refs;
    }

    for (const ref of refList) {
      if (!ref.query_id) {
        issues.push({
          type: 'invalid_expected_ref',
          severity: 'high',
          message: 'Expected reference is missing query_id',
          details: { ref }
        });
        continue;
      }

      if (!ref.expected_chunks && !ref.expected_documents) {
        issues.push({
          type: 'missing_expected_refs',
          query_id: ref.query_id,
          severity: 'medium',
          message: `Query '${ref.query_id}' has no expected chunks or documents`,
          details: { query_id: ref.query_id }
        });
      }

      refs.set(ref.query_id, {
        query_id: ref.query_id,
        expected_chunks: ref.expected_chunks || [],
        expected_documents: ref.expected_documents || [],
        explanation: ref.explanation
      });
    }

    return { refs, issues };
  }

  static async readEvalRules(filePath: string): Promise<EvalRules> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.load(content) as EvalRules;

    const defaults: EvalRules = {
      top_k_values: [1, 3, 5, 10],
      expired_documents: [],
      duplicate_threshold: 0.95,
      mrr_weight: 0.3,
      recall_weight: 0.4,
      coverage_weight: 0.3,
      minimum_acceptable_score: 0.6
    };

    return {
      ...defaults,
      ...data,
      top_k_values: data.top_k_values || defaults.top_k_values
    };
  }
}
