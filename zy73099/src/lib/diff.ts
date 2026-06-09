import type { DiffSegment, DiffResult } from '@/types';

export function computeTextDiff(before: string, after: string): DiffResult {
  const beforeChars = before.split('');
  const afterChars = after.split('');

  const dp: number[][] = Array.from({ length: beforeChars.length + 1 }, () =>
    new Array(afterChars.length + 1).fill(0)
  );

  for (let i = 1; i <= beforeChars.length; i++) {
    for (let j = 1; j <= afterChars.length; j++) {
      if (beforeChars[i - 1] === afterChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const segments: DiffSegment[] = [];
  let i = beforeChars.length;
  let j = afterChars.length;
  const rawSegments: { type: DiffSegment['type']; chars: string[] }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeChars[i - 1] === afterChars[j - 1]) {
      rawSegments.push({ type: 'equal', chars: [beforeChars[i - 1]] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawSegments.push({ type: 'added', chars: [afterChars[j - 1]] });
      j--;
    } else {
      rawSegments.push({ type: 'removed', chars: [beforeChars[i - 1]] });
      i--;
    }
  }

  rawSegments.reverse();

  let currentType: DiffSegment['type'] | null = null;
  let currentBuffer: string[] = [];

  for (const seg of rawSegments) {
    if (currentType === null) {
      currentType = seg.type;
      currentBuffer = seg.chars;
    } else if (currentType === seg.type) {
      currentBuffer.push(...seg.chars);
    } else {
      segments.push({ type: currentType, text: currentBuffer.join('') });
      currentType = seg.type;
      currentBuffer = seg.chars;
    }
  }

  if (currentType !== null) {
    segments.push({ type: currentType, text: currentBuffer.join('') });
  }

  let addedCount = 0;
  let removedCount = 0;

  for (const seg of segments) {
    if (seg.type === 'added') addedCount += seg.text.length;
    if (seg.type === 'removed') removedCount += seg.text.length;
  }

  return { segments, addedCount, removedCount };
}

export function serializeDiffResult(result: DiffResult): string {
  return JSON.stringify(result);
}

export function deserializeDiffResult(metadata: string | undefined): DiffResult | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as DiffResult;
  } catch {
    return null;
  }
}
