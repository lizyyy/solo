import { ParsedData, ArabicDirectionalityRisk, RuleResult } from '../types';
import { getCodePoints, isRightToLeft, isLeftToRight, isNeutral, isWhitespace, codePointToHex } from '../utils/unicode';

export function checkArabicDirectionalityRisks(data: ParsedData): RuleResult<ArabicDirectionalityRisk> {
  const issues: ArabicDirectionalityRisk[] = [];

  for (const sample of data.samples) {
    const codePoints = getCodePoints(sample.text);
    
    const hasRTL = codePoints.some(cp => isRightToLeft(cp));
    if (!hasRTL) continue;

    const hasLTR = codePoints.some(cp => isLeftToRight(cp));
    const hasNeutralNonWhitespace = codePoints.some(cp => isNeutral(cp) && !isWhitespace(cp));

    if (hasLTR || hasNeutralNonWhitespace) {
      const context = extractDirectionContext(sample.text, codePoints);
      
      issues.push({
        sampleId: sample.id,
        sampleText: sample.text,
        mixedDirection: hasLTR,
        hasNeutralChars: hasNeutralNonWhitespace,
        description: generateDirectionalityDescription(hasLTR, hasNeutralNonWhitespace),
        context
      });
    }
  }

  const uniqueIssues = deduplicateArabicRisks(issues);

  return {
    name: 'Arabic Directionality Risk Check',
    description: '检查阿拉伯文/希伯来文等 RTL 文本中的方向性风险，包括混合方向文本、中性字符等',
    passed: uniqueIssues.length === 0,
    issues: uniqueIssues
  };
}

function extractDirectionContext(text: string, codePoints: number[]): string {
  const contextParts: string[] = [];
  let currentDirection: 'ltr' | 'rtl' | 'neutral' | null = null;
  let currentRun = '';

  for (const cp of codePoints) {
    let direction: 'ltr' | 'rtl' | 'neutral';
    if (isRightToLeft(cp)) {
      direction = 'rtl';
    } else if (isLeftToRight(cp)) {
      direction = 'ltr';
    } else {
      direction = 'neutral';
    }

    const char = String.fromCodePoint(cp);

    if (currentDirection === null) {
      currentDirection = direction;
      currentRun = char;
    } else if (currentDirection === direction) {
      currentRun += char;
    } else {
      contextParts.push(formatDirectionRun(currentDirection, currentRun));
      currentDirection = direction;
      currentRun = char;
    }
  }

  if (currentRun) {
    contextParts.push(formatDirectionRun(currentDirection!, currentRun));
  }

  return contextParts.join(' → ');
}

function formatDirectionRun(direction: 'ltr' | 'rtl' | 'neutral', text: string): string {
  const dirLabel = direction === 'ltr' ? 'LTR' : direction === 'rtl' ? 'RTL' : 'Neutral';
  const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
  return `[${dirLabel}] "${escapeForDisplay(preview)}"`;
}

function escapeForDisplay(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function generateDirectionalityDescription(hasLTR: boolean, hasNeutral: boolean): string {
  const parts: string[] = [];

  if (hasLTR) {
    parts.push('包含 LTR 字符（数字、英文等）');
  }

  if (hasNeutral) {
    parts.push('包含中性字符（标点、符号等）');
  }

  if (parts.length === 0) {
    return '潜在的方向性问题';
  }

  return parts.join('，') + '，可能导致 Bidi 算法重新排序';
}

function deduplicateArabicRisks(issues: ArabicDirectionalityRisk[]): ArabicDirectionalityRisk[] {
  const seen = new Map<string, ArabicDirectionalityRisk>();

  for (const issue of issues) {
    if (!seen.has(issue.sampleId)) {
      seen.set(issue.sampleId, issue);
    }
  }

  return Array.from(seen.values());
}
