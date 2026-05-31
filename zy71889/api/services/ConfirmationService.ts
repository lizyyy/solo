import { ManualConfirmationRepository } from '../repositories/ManualConfirmationRepository.js';
import type { ManualConfirmation, CreateConfirmationRequest, TimelineEvent } from '../../shared/types.js';

export class ConfirmationService {
  private confirmationRepo = new ManualConfirmationRepository();

  getByBatchId(batchId: string): ManualConfirmation[] {
    return this.confirmationRepo.findByBatchId(batchId);
  }

  addConfirmation(batchId: string, request: CreateConfirmationRequest): ManualConfirmation {
    return this.confirmationRepo.create({
      batchId,
      timestamp: new Date().toISOString(),
      content: request.content,
      confirmer: request.confirmer,
      relatedItemId: request.relatedItemId,
      relatedItemType: request.relatedItemType,
    });
  }

  getTimelineEvents(batchId: string): TimelineEvent[] {
    const confirmations = this.getByBatchId(batchId);
    return confirmations.map((c) => ({
      id: c.id,
      batchId: c.batchId,
      timestamp: c.timestamp,
      type: 'manual_confirmation' as const,
      data: c,
    }));
  }
}
