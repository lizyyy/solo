import { dataStore } from '../store/dataStore';
import { reconciliationService } from './reconciliationService';
import { DiffDetail } from '../types';

export class ReviewService {
  async reviewDiff(
    resultId: string,
    diffId: string,
    reviewer: string,
    action: 'confirm' | 'resolve' | 'dismiss',
    notes?: string
  ): Promise<DiffDetail | undefined> {
    const result = dataStore.getReconciliationResult(resultId);
    if (!result) return undefined;

    const diffIndex = result.diffs.findIndex(d => d.id === diffId);
    if (diffIndex === -1) return undefined;

    const updatedDiff: DiffDetail = {
      ...result.diffs[diffIndex],
      status: action === 'resolve' ? 'resolved' : action === 'confirm' ? 'confirmed' : 'open',
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    };

    result.diffs[diffIndex] = updatedDiff;

    dataStore.updateReconciliationResult(resultId, {
      diffs: result.diffs,
    });

    dataStore.addReviewRecord({
      diffId,
      reviewer,
      action,
      notes,
    });

    await reconciliationService.recalculateSummary(resultId);

    return updatedDiff;
  }

  async batchReview(
    resultId: string,
    diffIds: string[],
    reviewer: string,
    action: 'confirm' | 'resolve' | 'dismiss',
    notes?: string
  ): Promise<DiffDetail[]> {
    const updatedDiffs: DiffDetail[] = [];
    
    for (const diffId of diffIds) {
      const diff = await this.reviewDiff(resultId, diffId, reviewer, action, notes);
      if (diff) {
        updatedDiffs.push(diff);
      }
    }
    
    return updatedDiffs;
  }

  getReviewHistory(diffId: string) {
    return dataStore.getReviewRecordsByDiff(diffId);
  }

  async recalculateResult(resultId: string) {
    return reconciliationService.recalculateSummary(resultId);
  }
}

export const reviewService = new ReviewService();
