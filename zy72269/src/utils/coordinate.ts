import type { InspectionMark } from '@/types';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function isValidCoordinate(x: number, y: number, z: number): boolean {
  return !isNaN(x) && !isNaN(y) && !isNaN(z) &&
         isFinite(x) && isFinite(y) && isFinite(z) &&
         Math.abs(x) < 10000 && Math.abs(y) < 10000 && Math.abs(z) < 1000;
}

export function checkZAxisConvention(z: number, sequenceNo: number): { isReversed: boolean; reason: string } {
  const isPositiveDownward = z > 0;
  const expectedTrend = sequenceNo > 1 ? z > 0 : false;

  if (isPositiveDownward) {
    return {
      isReversed: true,
      reason: `Z轴值为正(${z.toFixed(2)})，可能按旧习惯(向下为正)写反，新标准向上为正`
    };
  }

  if (expectedTrend) {
    return {
      isReversed: true,
      reason: `序号${sequenceNo}的Z轴值(${z.toFixed(2)})与序列趋势不符，可能写反`
    };
  }

  return { isReversed: false, reason: 'Z轴方向符合新标准(向上为正)' };
}

export function detectZAxisAbnormalities(marks: InspectionMark[]): Array<{
  markId: string;
  detectedZ: number;
  expectedZ: number;
  reason: string;
}> {
  const abnormalities: Array<{
    markId: string;
    detectedZ: number;
    expectedZ: number;
    reason: string;
  }> = [];

  const sortedMarks = [...marks].sort((a, b) => a.sequenceNo - b.sequenceNo);

  for (let i = 0; i < sortedMarks.length; i++) {
    const mark = sortedMarks[i];
    const check = checkZAxisConvention(mark.z, mark.sequenceNo);

    if (check.isReversed) {
      abnormalities.push({
        markId: mark.id,
        detectedZ: mark.z,
        expectedZ: -mark.z,
        reason: check.reason
      });
    }

    if (i > 0) {
      const prevMark = sortedMarks[i - 1];
      const zDiff = Math.abs(mark.z - prevMark.z);
      if (zDiff > 50) {
        abnormalities.push({
          markId: mark.id,
          detectedZ: mark.z,
          expectedZ: prevMark.z,
          reason: `与前一序号Z轴差值过大(${zDiff.toFixed(2)}m)，可能存在异常`
        });
      }
    }
  }

  return abnormalities;
}

export function formatCoordinate(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

export function calculateDistance(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculatePathLength(marks: InspectionMark[]): number {
  const sortedMarks = [...marks].sort((a, b) => a.sequenceNo - b.sequenceNo);
  let length = 0;
  for (let i = 1; i < sortedMarks.length; i++) {
    length += calculateDistance(sortedMarks[i - 1], sortedMarks[i]);
  }
  return length;
}
