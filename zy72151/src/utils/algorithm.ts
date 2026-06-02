export function levenshteinDistance(a: string, b: string): number {
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

export function stringSimilarity(a: string, b: string): number {
  const normalizedA = a.toLowerCase().replace(/\s+/g, '');
  const normalizedB = b.toLowerCase().replace(/\s+/g, '');
  
  if (normalizedA === normalizedB) return 1;
  
  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - distance / maxLen;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function standardizeName(name: string): string {
  let result = name
    .replace(/公交站|公交车站|站|站点|站台|站牌/g, '')
    .replace(/路口|交叉口|十字路口/g, '路口')
    .replace(/大道|大街|路|街|巷|弄/g, (match) => match)
    .replace(/\(.*?\)|（.*?）/g, '')
    .replace(/\s+/g, '')
    .trim();
  
  return result || name;
}

export interface MatchResult {
  similarity: number;
  distance: number;
  reason: string;
  shouldMerge: boolean;
  needsReview: boolean;
}

export function calculateMatch(
  name1: string,
  lat1: number,
  lng1: number,
  name2: string,
  lat2: number,
  lng2: number
): MatchResult {
  const similarity = stringSimilarity(name1, name2);
  const distance = haversineDistance(lat1, lng1, lat2, lng2);
  
  const stdName1 = standardizeName(name1);
  const stdName2 = standardizeName(name2);
  const stdSimilarity = stringSimilarity(stdName1, stdName2);
  
  const finalSimilarity = Math.max(similarity, stdSimilarity);
  
  let reason = '';
  let shouldMerge = false;
  let needsReview = false;
  
  if (finalSimilarity > 0.8 && distance < 50) {
    reason = '名称高度相似且距离极近';
    shouldMerge = true;
  } else if (finalSimilarity > 0.6 && distance < 100) {
    reason = '名称相似且距离较近';
    needsReview = true;
  } else if (distance < 20 && finalSimilarity > 0.4) {
    reason = '距离极近，可能为同一站点';
    needsReview = true;
  } else if (finalSimilarity > 0.7 && distance < 200) {
    reason = '名称相似但距离较远';
    needsReview = true;
  }
  
  return {
    similarity: finalSimilarity,
    distance,
    reason,
    shouldMerge,
    needsReview,
  };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
