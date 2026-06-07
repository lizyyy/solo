import { BoundaryRule } from '@/types';

export const DUPLICATE_NAME_RULES: BoundaryRule[] = [
  {
    id: 'name-suffix-common',
    name: '常见后缀差异',
    description: '如"阳光新村"与"阳光小区"、"阳光花园"判定为疑似同一小区',
    action: 'mark_review',
    rollbackable: true,
  },
  {
    id: 'name-prefix-phase',
    name: '期数/方位前缀差异',
    description: '如"东方明珠一期"与"东方明珠二期"、"明珠东区"与"明珠西区"需人工确认',
    action: 'mark_review',
    rollbackable: true,
  },
  {
    id: 'name-abbreviation',
    name: '全称/简称差异',
    description: '如"上海市浦东新区阳光小区"与"阳光小区"可能为同一小区',
    action: 'mark_review',
    rollbackable: true,
  },
];

const COMMUNITY_SUFFIXES = [
  '新村', '小区', '花园', '苑', '公寓', '大厦', '广场',
  '家园', '世家', '府邸', '华庭', '名邸', '城', '里',
  '坊', '弄', '村', '院', '庄', '阁', '轩', '庭',
];

const PHASE_PREFIXES = [
  '一期', '二期', '三期', '四期', '五期',
  '东区', '西区', '南区', '北区', '中区',
  'A区', 'B区', 'C区', 'D区',
  '东苑', '西苑', '南苑', '北苑',
];

export function normalizeCommunityName(name: string): string {
  if (!name) return '';
  let result = name.trim();
  result = result.replace(/[（）()【】\[\]「」""''、，。.,\s]/g, '');
  result = result.toLowerCase();
  return result;
}

export function extractCoreName(name: string): string {
  let core = normalizeCommunityName(name);
  for (const suffix of COMMUNITY_SUFFIXES) {
    if (core.endsWith(suffix)) {
      core = core.slice(0, -suffix.length);
      break;
    }
  }
  return core;
}

export function hasPhaseOrDirectionPrefix(name: string): boolean {
  const core = extractCoreName(name);
  return PHASE_PREFIXES.some((prefix) => core.includes(prefix));
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

export function isSuspectedSameCommunity(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  if (normalizeCommunityName(name1) === normalizeCommunityName(name2)) return true;
  const core1 = extractCoreName(name1);
  const core2 = extractCoreName(name2);
  if (core1 === core2 && core1.length >= 2) return true;
  const norm1 = normalizeCommunityName(name1);
  const norm2 = normalizeCommunityName(name2);
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen < 2) return false;
  const distance = levenshteinDistance(norm1, norm2);
  if (distance <= 1 && minLen >= 3) return true;
  if (norm1.includes(norm2) && norm2.length >= 2) return true;
  if (norm2.includes(norm1) && norm1.length >= 2) return true;
  return false;
}
