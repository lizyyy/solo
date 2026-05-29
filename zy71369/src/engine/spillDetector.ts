import type { Issue, BubbleVersion } from '../types';
import { generateId, estimateCapacity } from '../utils/helpers';

export function detectSpill(version: BubbleVersion): Issue | null {
  const charCount = version.text.length;
  const capacity = estimateCapacity(version.width, version.height);

  if (charCount > capacity) {
    return {
      id: generateId(),
      bubbleId: version.bubbleId,
      type: 'SPILL',
      description: `台词过长，当前 ${charCount} 字，估计容量 ${capacity} 字，超出 ${charCount - capacity} 字`,
      severity: 'WARNING',
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
      detectedBy: 'engine-v1.0',
    };
  }

  return null;
}

export function detectSpillForAll(
  versions: BubbleVersion[]
): Issue[] {
  return versions
    .map(v => detectSpill(v))
    .filter((v): v is Issue => v !== null);
}
