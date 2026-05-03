import { ParsedData, UnusedSubset, RuleResult, SubsetDefinition, UnicodeRange } from '../types';
import { getCodePoints } from '../utils/unicode';

export function checkUnusedSubsets(data: ParsedData): RuleResult<UnusedSubset> {
  const issues: UnusedSubset[] = [];
  const usedCodePoints = collectAllUsedCodePoints(data);

  for (const [subsetName, subset] of data.subsets) {
    const usage = analyzeSubsetUsage(subset, usedCodePoints);

    if (usage.totalChars === 0) {
      issues.push({
        subsetName,
        subsetDefinition: subset,
        reason: '子集定义了 Unicode 范围，但所有样本中都没有使用该范围内的任何字符'
      });
    } else if (usage.unusedRanges.length > 0) {
      const unusedRangeDesc = formatUnusedRanges(usage.unusedRanges);
      issues.push({
        subsetName,
        subsetDefinition: subset,
        reason: `子集包含 ${usage.unusedRanges.length} 个未使用的 Unicode 范围: ${unusedRangeDesc}`
      });
    }
  }

  return {
    name: 'Unused Subsets Check',
    description: '检查字体子集定义是否有未使用的范围或完全未被使用的子集',
    passed: issues.length === 0,
    issues
  };
}

function collectAllUsedCodePoints(data: ParsedData): Set<number> {
  const usedCodePoints = new Set<number>();

  for (const sample of data.samples) {
    const codePoints = getCodePoints(sample.text);
    for (const cp of codePoints) {
      usedCodePoints.add(cp);
    }
  }

  return usedCodePoints;
}

interface SubsetUsage {
  totalChars: number;
  unusedRanges: UnicodeRange[];
}

function analyzeSubsetUsage(
  subset: SubsetDefinition,
  usedCodePoints: Set<number>
): SubsetUsage {
  let totalChars = 0;
  const unusedRanges: UnicodeRange[] = [];

  for (const range of subset.unicodeRanges) {
    const rangeChars = countCharsInRange(range, usedCodePoints);
    totalChars += rangeChars;

    if (rangeChars === 0) {
      unusedRanges.push(range);
    }
  }

  return { totalChars, unusedRanges };
}

function countCharsInRange(
  range: UnicodeRange,
  usedCodePoints: Set<number>
): number {
  let count = 0;
  for (const cp of usedCodePoints) {
    if (cp >= range.start && cp <= range.end) {
      count++;
    }
  }
  return count;
}

function formatUnusedRanges(ranges: UnicodeRange[]): string {
  const formatted = ranges.slice(0, 5).map(range => {
    const name = range.name ? ` "${range.name}"` : '';
    return `${codePointToHex(range.start)}-${codePointToHex(range.end)}${name}`;
  });

  if (ranges.length > 5) {
    formatted.push(`... 还有 ${ranges.length - 5} 个范围`);
  }

  return formatted.join(', ');
}

function codePointToHex(codePoint: number): string {
  return 'U+' + codePoint.toString(16).toUpperCase().padStart(4, '0');
}
