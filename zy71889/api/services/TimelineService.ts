import { BatchService } from './BatchService.js';
import { CorrectionService } from './CorrectionService.js';
import { ConfirmationService } from './ConfirmationService.js';
import { GradingService } from './GradingService.js';
import type { TimelineEvent } from '../../shared/types.js';

export class TimelineService {
  private batchService = new BatchService();
  private correctionService = new CorrectionService();
  private confirmationService = new ConfirmationService();
  private gradingService = new GradingService();

  getFullTimeline(batchId: string): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    events.push(...this.batchService.getTimeline(batchId));
    events.push(...this.correctionService.getTimelineEvents(batchId));
    events.push(...this.confirmationService.getTimelineEvents(batchId));
    events.push(...this.gradingService.getTimelineEvents(batchId));

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}
