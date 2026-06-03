import type * as T from '@/types';

function generateId(): string {
  return `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function detectOcclusion(screenshotUrl: string): boolean {
  if (screenshotUrl.toLowerCase().includes('occluded')) {
    return true;
  }
  return Math.random() < 0.3;
}

export function markForReview(recordId: string): T.AlarmReview {
  return {
    id: generateId(),
    recordId,
    reviewStatus: 'pending',
    reviewComment: '',
    reviewedAt: '',
    reviewedBy: '',
  };
}
