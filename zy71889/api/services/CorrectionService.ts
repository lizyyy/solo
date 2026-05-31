import { CorrectionRepository } from '../repositories/CorrectionRepository.js';
import type { Correction, CreateCorrectionRequest, TimelineEvent } from '../../shared/types.js';

export class CorrectionService {
  private correctionRepo = new CorrectionRepository();

  getByBatchId(batchId: string): Correction[] {
    return this.correctionRepo.findByBatchId(batchId);
  }

  addCorrection(batchId: string, request: CreateCorrectionRequest): Correction {
    return this.correctionRepo.create({
      batchId,
      timestamp: new Date().toISOString(),
      content: request.content,
      author: request.author,
      category: request.category,
      points: request.points,
    });
  }

  getTimelineEvents(batchId: string): TimelineEvent[] {
    const corrections = this.getByBatchId(batchId);
    return corrections.map((c) => ({
      id: c.id,
      batchId: c.batchId,
      timestamp: c.timestamp,
      type: 'correction' as const,
      data: c,
    }));
  }
}
