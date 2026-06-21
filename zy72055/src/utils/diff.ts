export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

function tokenize(str: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let isChinese = false;
  
  for (const char of str) {
    const charCode = char.charCodeAt(0);
    const isCharChinese = charCode >= 0x4e00 && charCode <= 0x9fff;
    const isWhitespace = /\s/.test(char);
    const isPunctuation = /[，。、；：""''（）【】《》！？,.!?;:"'()[\]<>]/.test(char);
    
    if (isWhitespace || isPunctuation) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
      isChinese = false;
    } else if (isCharChinese) {
      if (current && !isChinese) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
      isChinese = true;
    } else {
      if (current && isChinese) {
        tokens.push(current);
        current = '';
      }
      current += char;
      isChinese = false;
    }
  }
  
  if (current) {
    tokens.push(current);
  }
  
  return tokens;
}

export function diffStrings(oldStr: string, newStr: string): DiffSegment[] {
  const oldTokens = tokenize(oldStr);
  const newTokens = tokenize(newStr);
  
  const dp: number[][] = [];
  for (let i = 0; i <= oldTokens.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= newTokens.length; j++) {
      if (i === 0 || j === 0) {
        dp[i][j] = 0;
      } else if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  const segments: DiffSegment[] = [];
  let i = oldTokens.length;
  let j = newTokens.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      segments.unshift({ type: 'unchanged', content: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      segments.unshift({ type: 'added', content: newTokens[j - 1] });
      j--;
    } else if (i > 0) {
      segments.unshift({ type: 'removed', content: oldTokens[i - 1] });
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
