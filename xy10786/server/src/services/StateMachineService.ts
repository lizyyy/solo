import { ContentStatus, ReviewAction, ChannelType, ContentItem } from '../types';

export class StateMachineService {
  private static readonly VALID_TRANSITIONS: Map<ContentStatus, ContentStatus[]> = new Map([
    [ContentStatus.DRAFT, [ContentStatus.PENDING_REVIEW, ContentStatus.WITHDRAWN]],
    [ContentStatus.PENDING_REVIEW, [ContentStatus.APPROVED, ContentStatus.NEEDS_REVIEW, ContentStatus.BLOCKED, ContentStatus.WITHDRAWN]],
    [ContentStatus.APPROVED, [ContentStatus.SCHEDULED, ContentStatus.PUBLISHING, ContentStatus.WITHDRAWN]],
    [ContentStatus.SCHEDULED, [ContentStatus.PUBLISHING, ContentStatus.WITHDRAWN, ContentStatus.DRAFT]],
    [ContentStatus.PUBLISHING, [ContentStatus.PUBLISHED, ContentStatus.RETRYABLE, ContentStatus.FAILED]],
    [ContentStatus.PUBLISHED, [ContentStatus.SYNCING, ContentStatus.WITHDRAWN]],
    [ContentStatus.SYNCING, [ContentStatus.SYNCED, ContentStatus.RETRYABLE, ContentStatus.FAILED]],
    [ContentStatus.SYNCED, [ContentStatus.WITHDRAWN]],
    [ContentStatus.NEEDS_REVIEW, [ContentStatus.PENDING_REVIEW, ContentStatus.WITHDRAWN]],
    [ContentStatus.RETRYABLE, [ContentStatus.PUBLISHING, ContentStatus.SYNCING, ContentStatus.FAILED]],
    [ContentStatus.FAILED, [ContentStatus.RETRYABLE, ContentStatus.WITHDRAWN, ContentStatus.DRAFT]],
    [ContentStatus.BLOCKED, [ContentStatus.DRAFT, ContentStatus.WITHDRAWN]],
    [ContentStatus.WITHDRAWN, [ContentStatus.DRAFT]]
  ]);

  static canTransition(currentStatus: ContentStatus, nextStatus: ContentStatus): boolean {
    const validNext = this.VALID_TRANSITIONS.get(currentStatus);
    return validNext ? validNext.includes(nextStatus) : false;
  }

  static getNextStatuses(currentStatus: ContentStatus): ContentStatus[] {
    return this.VALID_TRANSITIONS.get(currentStatus) || [];
  }

  static validateTransition(content: ContentItem, nextStatus: ContentStatus): { valid: boolean; message?: string } {
    if (!this.canTransition(content.status, nextStatus)) {
      return {
        valid: false,
        message: `Cannot transition from ${content.status} to ${nextStatus}`
      };
    }

    if (nextStatus === ContentStatus.SCHEDULED && !content.scheduledAt) {
      return {
        valid: false,
        message: 'Scheduled time is required for scheduled status'
      };
    }

    return { valid: true };
  }

  static getStatusForReviewAction(action: ReviewAction): ContentStatus {
    switch (action) {
      case ReviewAction.APPROVE:
        return ContentStatus.APPROVED;
      case ReviewAction.REJECT:
        return ContentStatus.NEEDS_REVIEW;
      case ReviewAction.WITHDRAW:
        return ContentStatus.WITHDRAWN;
      case ReviewAction.RESUBMIT:
        return ContentStatus.PENDING_REVIEW;
      default:
        throw new Error(`Unknown review action: ${action}`);
    }
  }

  static canRetry(content: ContentItem): boolean {
    return content.retryCount < content.maxRetries && 
           (content.status === ContentStatus.RETRYABLE || content.status === ContentStatus.FAILED);
  }

  static canChannelRetry(channel: any): boolean {
    return channel.retryCount < channel.maxRetries &&
           (channel.status === ContentStatus.RETRYABLE || channel.status === ContentStatus.FAILED);
  }
}
