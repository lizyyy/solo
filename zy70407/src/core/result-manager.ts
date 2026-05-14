import { v4 as uuidv4 } from 'uuid';
import {
  ProcessingResult,
  ReviewRecord,
  ApprovalTicket,
  ApprovalTimeline
} from '../types';
import { createHash } from 'crypto';

export class ResultManager {
  private results: Map<string, ProcessingResult> = new Map();
  private reviews: Map<string, ReviewRecord> = new Map();
  private contentHashIndex: Map<string, string[]> = new Map();

  saveResult(result: ProcessingResult): void {
    this.results.set(result.batchId, result);
    
    const contentHash = this.generateBatchContentHash(result.timeline, result.ticketId);
    if (!this.contentHashIndex.has(contentHash)) {
      this.contentHashIndex.set(contentHash, []);
    }
    this.contentHashIndex.get(contentHash)!.push(result.batchId);
  }

  getResult(batchId: string): ProcessingResult | undefined {
    return this.results.get(batchId);
  }

  getAllResults(): ProcessingResult[] {
    return Array.from(this.results.values());
  }

  findDuplicates(timeline: ApprovalTimeline, ticketId: string): string[] {
    const contentHash = this.generateBatchContentHash(timeline, ticketId);
    return this.contentHashIndex.get(contentHash) || [];
  }

  checkForConflicts(newResult: ProcessingResult): string[] {
    const conflicts: string[] = [];
    const existingBatchIds = this.findDuplicates(newResult.timeline, newResult.ticketId);
    
    for (const existingBatchId of existingBatchIds) {
      if (existingBatchId === newResult.batchId) continue;
      
      const existingResult = this.results.get(existingBatchId);
      if (!existingResult) continue;

      if (existingResult.finalStatus !== newResult.finalStatus) {
        conflicts.push(
          `与批次 ${existingBatchId} 存在状态冲突：旧批次为 ${existingResult.finalStatus}，新批次为 ${newResult.finalStatus}`
        );
      }

      if (existingResult.ruleSnapshotVersion !== newResult.ruleSnapshotVersion) {
        conflicts.push(
          `与批次 ${existingBatchId} 使用了不同版本的规则：旧版本 ${existingResult.ruleSnapshotVersion}，新版本 ${newResult.ruleSnapshotVersion}`
        );
      }
    }

    return conflicts;
  }

  reuseExistingResult(batchId: string, existingBatchId: string): ProcessingResult | null {
    const existingResult = this.results.get(existingBatchId);
    if (!existingResult) return null;

    return {
      ...existingResult,
      batchId,
      processedAt: new Date(),
      isDuplicate: true,
      duplicateOfBatchId: existingBatchId
    };
  }

  addReview(review: ReviewRecord): void {
    this.reviews.set(review.id, review);
  }

  getReviewsForBatch(batchId: string): ReviewRecord[] {
    return Array.from(this.reviews.values()).filter(r => r.batchId === batchId);
  }

  getEscalationTicketReferences(batchId: string): string[] {
    const reviews = this.getReviewsForBatch(batchId);
    return reviews
      .filter(r => r.escalationTicketId)
      .map(r => r.escalationTicketId!);
  }

  canOverrideResult(batchId: string): boolean {
    const reviews = this.getReviewsForBatch(batchId);
    const lastReview = reviews[reviews.length - 1];
    
    if (!lastReview) return true;
    return lastReview.reviewDecision === 'uphold';
  }

  private generateBatchContentHash(timeline: ApprovalTimeline, ticketId: string): string {
    const eventSignatures = timeline.events.map(event => 
      `${event.timestamp.getTime()}-${event.eventType}-${event.actor.id}`
    ).sort().join('|');
    
    const content = `${ticketId}|${eventSignatures}`;
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  exportResults(filePath: string): void {
    const data = {
      results: Array.from(this.results.values()),
      reviews: Array.from(this.reviews.values()),
      exportedAt: new Date().toISOString()
    };
    const fs = require('fs');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  importResults(filePath: string): void {
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    for (const result of data.results) {
      this.results.set(result.batchId, {
        ...result,
        processedAt: new Date(result.processedAt),
        timeline: {
          ...result.timeline,
          startTime: new Date(result.timeline.startTime),
          endTime: result.timeline.endTime ? new Date(result.timeline.endTime) : undefined,
          events: result.timeline.events.map((e: any) => ({
            ...e,
            timestamp: new Date(e.timestamp),
            rawLog: {
              ...e.rawLog,
              timestamp: new Date(e.rawLog.timestamp)
            }
          }))
        },
        ruleResults: result.ruleResults.map((r: any) => ({
          ...r,
          evaluatedAt: new Date(r.evaluatedAt)
        }))
      });
    }

    for (const review of data.reviews) {
      this.reviews.set(review.id, {
        ...review,
        reviewedAt: new Date(review.reviewedAt)
      });
    }
  }
}

export function createReviewRecord(
  batchId: string,
  reviewerId: string,
  reviewerName: string,
  reviewComment: string,
  reviewDecision: 'uphold' | 'override' | 'escalate',
  originalResultId: string,
  overrideReason?: string,
  escalationTicketId?: string
): ReviewRecord {
  return {
    id: uuidv4(),
    batchId,
    reviewerId,
    reviewerName,
    reviewedAt: new Date(),
    reviewComment,
    reviewDecision,
    overrideReason,
    escalationTicketId,
    originalResultId
  };
}
