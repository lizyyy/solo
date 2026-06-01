export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export function diffStrings(oldStr: string, newStr: string): DiffSegment[] {
  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);
  
  const dp: number[][] = [];
  for (let i = 0; i <= oldWords.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= newWords.length; j++) {
      if (i === 0 || j === 0) {
        dp[i][j] = 0;
      } else if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  const segments: DiffSegment[] = [];
  let i = oldWords.length;
  let j = newWords.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      segments.unshift({ type: 'unchanged', content: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      segments.unshift({ type: 'added', content: newWords[j - 1] });
      j--;
    } else if (i > 0) {
      segments.unshift({ type: 'removed', content: oldWords[i - 1] });
      i--;
    }
  }
  
  return mergeSegments(segments);
}

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];
  
  const merged: DiffSegment[] = [segments[0]];
  
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    const current = segments[i];
    
    if (last.type === current.type) {
      last.content += current.content;
    } else {
      merged.push({ ...current });
    }
  }
  
  return merged;
}

export function renderDiff(segments: DiffSegment[]): string {
  return segments
    .map(s => {
      switch (s.type) {
        case 'added':
          return `<span class="diff-added">${s.content}</span>`;
        case 'removed':
          return `<span class="diff-removed">${s.content}</span>`;
        default:
          return s.content;
      }
    })
    .join('');
}
