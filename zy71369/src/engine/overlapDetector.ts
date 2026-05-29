import type { Issue, BubbleVersion } from '../types';
import { generateId, calculateOverlapArea } from '../utils/helpers';

export function detectOverlap(
  bubbles: { version: BubbleVersion; sequenceNumber: number }[]
): Issue[] {
  const issues: Issue[] = [];

  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i].version;
      const b = bubbles[j].version;
      const aSeq = bubbles[i].sequenceNumber;
      const bSeq = bubbles[j].sequenceNumber;

      const overlap = calculateOverlapArea(a, b);
      const minArea = Math.min(a.width * a.height, b.width * b.height);
      const overlapRatio = overlap / minArea;

      if (overlap > minArea * 0.1) {
        issues.push({
          id: generateId(),
          bubbleId: a.bubbleId,
          relatedBubbleId: b.bubbleId,
          type: 'OVERLAP',
          description: `气泡 ${aSeq} 与 ${bSeq} 重叠，重叠面积占比 ${(overlapRatio * 100).toFixed(1)}%`,
          severity: 'ERROR',
          status: 'OPEN',
          detectedAt: new Date().toISOString(),
          detectedBy: 'engine-v1.0',
        });
      }
    }
  }

  return issues;
}
