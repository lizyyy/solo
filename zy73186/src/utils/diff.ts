import * as Diff from 'diff';
import type { DiffChunk } from '../types';

export function diffWords(oldStr: string, newStr: string): Diff.Change[] {
  return Diff.diffWords(oldStr, newStr);
}

export function compareVersions(oldContent: string, newContent: string): DiffChunk[] {
  const changes: DiffChunk[] = [];
  const diffResult = Diff.diffWords(oldContent, newContent);

  for (const part of diffResult) {
    if (part.added) {
      changes.push({
        type: 'added',
        value: part.value,
      });
    } else if (part.removed) {
      changes.push({
        type: 'removed',
        value: part.value,
      });
    }
  }

  return changes;
}

export function detectCaliberChange(
  oldContent: string,
  newContent: string,
  threshold: number = 0.1
): boolean {
  if (oldContent === newContent) return false;

  const totalLength = Math.max(oldContent.length, newContent.length);
  if (totalLength === 0) return false;

  const editDistance = calculateEditDistance(oldContent, newContent);
  const changeRatio = editDistance / totalLength;

  return changeRatio > threshold;
}

export function calculateEditDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function formatDiff(chunks: DiffChunk[]): string {
  return chunks
    .map((chunk) => {
      switch (chunk.type) {
        case 'added':
          return `[+${chunk.value}]`;
        case 'removed':
          return `[-${chunk.value}]`;
        case 'modified':
          return `[*${chunk.oldValue} → ${chunk.value}]`;
        default:
          return chunk.value;
      }
    })
    .join(' ');
}
