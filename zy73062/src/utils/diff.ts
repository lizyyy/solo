import type { DiffSpan } from '../types/schedule';

// 判断字符是否为 ASCII（英文/数字/符号）
function isAscii(char: string): boolean {
  return char.charCodeAt(0) <= 127;
}

// 分词：中文按字切分，英文按词（连续 ASCII 字符为一个词）切分
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buffer = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isAscii(ch)) {
      buffer += ch;
    } else {
      // 遇到中文，先 flush buffer
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
      tokens.push(ch);
    }
  }
  // flush 剩余 buffer
  if (buffer) {
    tokens.push(buffer);
  }

  return tokens;
}

// 对 alarm 和 remark 进行差异对比
// 返回 [alarmSpans, remarkSpans]，每个都是 DiffSpan 数组
// 算法：逐词分词，用 Set 找出对方不存在的词标记为 isDiff=true
export function diffAlarmVsRemark(
  alarm: string,
  remark: string,
): [DiffSpan[], DiffSpan[]] {
  const alarmTokens = tokenize(alarm || '');
  const remarkTokens = tokenize(remark || '');

  // 构建双方的词集合
  const alarmSet = new Set(alarmTokens);
  const remarkSet = new Set(remarkTokens);

  // 将 tokens 转换为 DiffSpan 数组，并合并相邻相同 isDiff 的 token
  const buildSpans = (tokens: string[], otherSet: Set<string>): DiffSpan[] => {
    const rawSpans: DiffSpan[] = tokens.map((t) => ({
      text: t,
      isDiff: !otherSet.has(t),
    }));

    // 合并相邻且 isDiff 相同的 span
    const merged: DiffSpan[] = [];
    for (const span of rawSpans) {
      const last = merged[merged.length - 1];
      if (last && last.isDiff === span.isDiff) {
        last.text += span.text;
      } else {
        merged.push({ text: span.text, isDiff: span.isDiff });
      }
    }

    return merged;
  };

  const alarmSpans = buildSpans(alarmTokens, remarkSet);
  const remarkSpans = buildSpans(remarkTokens, alarmSet);

  return [alarmSpans, remarkSpans];
}
