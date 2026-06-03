import type { InspectionMark, ZAxisAbnormal, ReviewRecord } from '@/types';
import { detectZAxisAbnormalities, checkZAxisConvention } from '@/utils/coordinate';
import { generateUUID } from '@/utils/coordinate';

export function detectZAxisAbnormalitiesInMarks(marks: InspectionMark[]): ZAxisAbnormal[] {
  const abnormalities = detectZAxisAbnormalities(marks);
  const now = new Date().toISOString();

  return abnormalities.map(ab => ({
    id: generateUUID(),
    markId: ab.markId,
    detectedZ: ab.detectedZ,
    expectedZ: ab.expectedZ,
    suspicionReason: ab.reason,
    reviewStatus: 'pending' as const,
    detectedAt: now
  }));
}

export function checkOldConvention(z: number, sequenceNo: number): {
  isReversed: boolean;
  reason: string;
} {
  return checkZAxisConvention(z, sequenceNo);
}

export function submitReview(
  abnormal: ZAxisAbnormal,
  result: string,
  reviewerName: string,
  signature: string,
  sitePhoto?: string
): ZAxisAbnormal {
  const isCorrected = result.includes('修正') || result.includes('更正') || result.includes('反向');

  const reviewRecord: ReviewRecord = {
    id: generateUUID(),
    abnormalId: abnormal.id,
    reviewerName,
    reviewResult: result,
    sitePhoto,
    signature,
    reviewedAt: new Date().toISOString()
  };

  return {
    ...abnormal,
    reviewStatus: isCorrected ? 'corrected' : 'approved',
    reviewRecord
  };
}

export function getReviewStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待复核',
    approved: '复核通过',
    corrected: '已修正'
  };
  return labels[status] || status;
}

export function shouldAutoCorrect(abnormal: ZAxisAbnormal): boolean {
  return false;
}

export function getZAxisExplanation(): {
  oldConvention: string;
  newConvention: string;
  reason: string;
} {
  return {
    oldConvention: 'Z轴向下为正（旧习惯）',
    newConvention: 'Z轴向上为正（新标准）',
    reason: '为与楼层标高系统保持一致，采用右手坐标系，Z轴向上为正。旧数据可能按向下为正记录，需现场复核。'
  };
}

export function calculateZScore(marks: InspectionMark[]): {
  total: number;
  normal: number;
  suspicious: number;
  score: number;
} {
  const abnormalities = detectZAxisAbnormalitiesInMarks(marks);
  const suspicious = abnormalities.length;
  const total = marks.length;
  const normal = total - suspicious;
  const score = total > 0 ? Math.round((normal / total) * 100) : 100;

  return { total, normal, suspicious, score };
}
