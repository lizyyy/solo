import type { Coordinate, IssueFlag } from '@/shared/types';

export const COORDINATE_OFFSET_THRESHOLD = 0.5; // 0.5米阈值

export function calcOffset(a: Coordinate, b: Coordinate): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function formatCoord(c: Coordinate): string {
  return `(${c.x.toFixed(3)}, ${c.y.toFixed(3)}, ${c.z.toFixed(3)})`;
}

export function validateCoordinate(
  itemId: string,
  visaCoord: Coordinate | null,
  modelCoord: Coordinate | null,
): IssueFlag | null {
  if (!visaCoord || !modelCoord) return null;
  const offset = calcOffset(visaCoord, modelCoord);
  if (offset > COORDINATE_OFFSET_THRESHOLD) {
    return {
      issueId: `issue-coord-${itemId}`,
      itemId,
      issueType: 'coordinate_offset',
      description: `模型坐标偏移量 ${offset.toFixed(3)}m，超过阈值 ${COORDINATE_OFFSET_THRESHOLD}m`,
      sourceEvidence: `签证单原始坐标 ${formatCoord(visaCoord)} vs 模型坐标 ${formatCoord(modelCoord)}，差值 ${offset.toFixed(3)}m`,
      holdReason: '坐标偏差过大，需现场复核后再进入最终报告',
      blocksFinalReport: true,
    };
  }
  return null;
}
