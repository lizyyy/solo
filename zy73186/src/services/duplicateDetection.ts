import type { SuspendedTask, DuplicateInfo, Material } from '../types';
import { generateId } from '../utils/hash';
import { isContentSimilar, calculateCombinedSimilarity } from '../utils/similarity';

export const duplicateDetectionService = {
  async findDuplicate(
    sampleContent: string,
    existingMaterials: Material[],
    threshold: number = 0.85
  ): Promise<{
    isDuplicate: boolean;
    isSimilar: boolean;
    similarity: number;
    existingMaterial?: Material;
    existingSessionId?: string;
  }> {
    const boundarySamples = existingMaterials.filter((m) => m.type === 'boundary_sample');

    for (const existing of boundarySamples) {
      const result = isContentSimilar(sampleContent, existing.content, threshold);

      if (result.isSimilar) {
        return {
          isDuplicate: true,
          isSimilar: true,
          similarity: result.similarity,
          existingMaterial: existing,
          existingSessionId: existing.sessionId,
        };
      }
    }

    return {
      isDuplicate: false,
      isSimilar: false,
      similarity: 0,
    };
  },

  async checkSimilarity(
    sampleContent: string,
    existingMaterials: Material[],
    threshold: number = 0.85
  ): Promise<{
    isSimilar: boolean;
    similarity: number;
    existingMaterial?: Material;
    existingSessionId?: string;
  }> {
    const result = await this.findDuplicate(sampleContent, existingMaterials, threshold);
    return {
      isSimilar: result.isSimilar,
      similarity: result.similarity,
      existingMaterial: result.existingMaterial,
      existingSessionId: result.existingSessionId,
    };
  },

  calculateSimilarity(a: string, b: string): number {
    return calculateCombinedSimilarity(a, b);
  },

  async createSuspendedTask(
    sessionId: string,
    reason: 'duplicate_sample' | 'caliber_change',
    duplicateInfo?: DuplicateInfo,
    description?: string,
    createdBy: string = '系统'
  ): Promise<SuspendedTask> {
    const defaultDescription = reason === 'duplicate_sample'
      ? '检测到重复样本，需要人工确认处理方式'
      : '检测到材料口径变更，需要人工确认处理方式';

    return {
      id: generateId(),
      sessionId,
      reason,
      duplicateInfo,
      status: 'pending',
      description: description || defaultDescription,
      createdBy,
      createdAt: Date.now(),
    };
  },

  resolveSuspendedTask(
    task: SuspendedTask,
    resolution: 'confirmed' | 'rejected',
    resolvedBy: string,
    resolutionNote?: string
  ): SuspendedTask {
    return {
      ...task,
      status: resolution,
      resolvedAt: Date.now(),
      resolvedBy,
      resolutionNote,
    };
  },

  batchCheckDuplicates(
    samples: string[],
    existingMaterials: Material[],
    threshold: number = 0.85
  ): Promise<
    Array<{
      sampleIndex: number;
      isDuplicate: boolean;
      isSimilar: boolean;
      similarity: number;
      existingSessionId?: string;
    }>
  > {
    return Promise.all(
      samples.map(async (sample, index) => {
        const result = await this.findDuplicate(sample, existingMaterials, threshold);
        return {
          sampleIndex: index,
          isDuplicate: result.isDuplicate,
          isSimilar: result.isSimilar,
          similarity: result.similarity,
          existingSessionId: result.existingSessionId,
        };
      })
    );
  },

  getDuplicateWarningMessage(similarity: number): string {
    if (similarity >= 0.95) {
      return '高度相似样本（≥95%），极可能为重复提交';
    } else if (similarity >= 0.85) {
      return '较高相似度样本（≥85%），可能为重复提交';
    } else if (similarity >= 0.7) {
      return '存在一定相似度（≥70%），建议人工确认';
    }
    return '相似度较低，暂不判定为重复';
  },

  getSimilarityColor(similarity: number): string {
    if (similarity >= 0.95) return '#c53030';
    if (similarity >= 0.85) return '#dd6b20';
    if (similarity >= 0.7) return '#d69e2e';
    return '#38a169';
  },

  formatSimilarity(similarity: number): string {
    return `${(similarity * 100).toFixed(1)}%`;
  },
};
