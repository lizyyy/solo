import { KnowledgeChunk, QueryItem, SearchResult, QueryResult, ExpectedRef } from './types';

export class VectorSearcher {
  private chunks: KnowledgeChunk[];
  private expectedRefs: Map<string, ExpectedRef>;

  constructor(chunks: KnowledgeChunk[], expectedRefs: Map<string, ExpectedRef>) {
    this.chunks = chunks;
    this.expectedRefs = expectedRefs;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitudeA = Math.sqrt(normA);
    const magnitudeB = Math.sqrt(normB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  search(queryEmbedding: number[], topK: number = 10): SearchResult[] {
    const scores: { chunk: KnowledgeChunk; score: number }[] = [];

    for (const chunk of this.chunks) {
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      scores.push({ chunk, score: similarity });
    }

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map((item, index) => ({
      chunk: item.chunk,
      score: item.score,
      rank: index + 1
    }));
  }

  searchAllQueries(queries: QueryItem[], topK: number = 10): QueryResult[] {
    const results: QueryResult[] = [];

    for (const query of queries) {
      const actualResults = this.search(query.query_embedding, topK);
      const expectedRef = this.expectedRefs.get(query.id);

      results.push({
        query_id: query.id,
        query: query.query,
        actual_results: actualResults,
        expected_chunks: expectedRef?.expected_chunks || [],
        expected_documents: expectedRef?.expected_documents || []
      });
    }

    return results;
  }

  findDuplicateChunks(threshold: number = 0.95): { chunk1: string; chunk2: string; similarity: number }[] {
    const duplicates: { chunk1: string; chunk2: string; similarity: number }[] = [];

    for (let i = 0; i < this.chunks.length; i++) {
      for (let j = i + 1; j < this.chunks.length; j++) {
        const chunk1 = this.chunks[i];
        const chunk2 = this.chunks[j];

        if (chunk1.document_id !== chunk2.document_id) {
          continue;
        }

        const similarity = this.cosineSimilarity(chunk1.embedding, chunk2.embedding);

        if (similarity >= threshold) {
          duplicates.push({
            chunk1: chunk1.id,
            chunk2: chunk2.id,
            similarity
          });
        }
      }
    }

    return duplicates;
  }
}
