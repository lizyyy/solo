import type { Issue, BubbleVersion } from '../types';
import { generateId } from '../utils/helpers';
import { detectOverlap } from './overlapDetector';
import { detectSpillForAll } from './spillDetector';

export function detectSequenceError(
  sortedBubbles: { version: BubbleVersion; sequenceNumber: number }[]
): Issue[] {
  const issues: Issue[] = [];

  for (let i = 1; i < sortedBubbles.length; i++) {
    const prev = sortedBubbles[i - 1];
    const curr = sortedBubbles[i];

    if (curr.version.y < prev.version.y - 20) {
      issues.push({
        id: generateId(),
        bubbleId: curr.version.bubbleId,
        type: 'SEQUENCE',
        description: `阅读顺序可能错误，气泡 ${curr.sequenceNumber} 位置在气泡 ${prev.sequenceNumber} 上方`,
        severity: 'WARNING',
        status: 'OPEN',
        detectedAt: new Date().toISOString(),
        detectedBy: 'engine-v1.0',
      });
    }
  }

  return issues;
}

export function runAllChecks(
  bubbles: { version: BubbleVersion; sequenceNumber: number }[]
): Issue[] {
  const sortedBySeq = [...bubbles].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const overlapIssues = detectOverlap(sortedBySeq);
  const spillIssues = detectSpillForAll(sortedBySeq.map(b => b.version));
  const sequenceIssues = detectSequenceError(sortedBySeq);

  return [...overlapIssues, ...spillIssues, ...sequenceIssues];
}
