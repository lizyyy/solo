import type * as T from '@/types';

function generateId(): string {
  return `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const OCCLUSION_KEYWORDS = [
  'occluded',
  '遮挡',
  '挡',
  '模糊',
  'blur',
  'blocked',
  '手指',
  'finger',
  '反光',
  'glare',
];

export function normalizeAlarmOccluded(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === '是' || s === '有' || s === 'yes' || s === 'y') return true;
    if (s === 'false' || s === '0' || s === '否' || s === '无' || s === '没有' || s === 'no' || s === 'n' || s === '') return false;
  }
  return false;
}

export function detectOcclusion(screenshotUrl: string): boolean {
  if (!screenshotUrl || typeof screenshotUrl !== 'string') return false;
  const lower = screenshotUrl.toLowerCase();
  return OCCLUSION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
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
