export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const dp: number[][] = [];
  for (let i = 0; i <= oldLines.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= newLines.length; j++) {
      dp[i][j] = 0;
    }
  }

  for (let i = oldLines.length - 1; i >= 0; i--) {
    for (let j = newLines.length - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let lineNumber = 1;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      result.push({ type: 'unchanged', content: oldLines[i], lineNumber });
      i++;
      j++;
      lineNumber++;
    } else if (j < newLines.length && (i >= oldLines.length || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ type: 'added', content: newLines[j], lineNumber });
      j++;
      lineNumber++;
    } else {
      result.push({ type: 'removed', content: oldLines[i], lineNumber });
      i++;
    }
  }

  return result;
}
