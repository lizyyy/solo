export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

export function textSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function distanceSimilarity(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const distance = haversineDistance(lat1, lng1, lat2, lng2);
  const maxDistance = 500;
  if (distance > maxDistance) return 0;
  return 1 - distance / maxDistance;
}

export interface SimilarityResult {
  overall: number;
  breakdown: {
    address: number;
    name: number;
    distance: number;
  };
}

export function calculateSimilarity(
  name1: string,
  address1: string,
  lat1: number,
  lng1: number,
  name2: string,
  address2: string,
  lat2: number,
  lng2: number
): SimilarityResult {
  const nameSim = textSimilarity(name1, name2);
  const addressSim = textSimilarity(address1, address2);
  const distSim = distanceSimilarity(lat1, lng1, lat2, lng2);

  const overall = addressSim * 0.4 + nameSim * 0.3 + distSim * 0.3;

  return {
    overall,
    breakdown: {
      address: addressSim,
      name: nameSim,
      distance: distSim,
    },
  };
}

export function getMergeReason(
  similarity: SimilarityResult,
  name1: string,
  name2: string
): string {
  const reasons: string[] = [];

  if (similarity.breakdown.address > 0.8) {
    reasons.push('地址高度相似');
  } else if (similarity.breakdown.address > 0.6) {
    reasons.push('地址部分相似');
  }

  if (similarity.breakdown.name > 0.7) {
    reasons.push('名称相似');
  }

  if (similarity.breakdown.distance > 0.9) {
    reasons.push('地理位置非常接近');
  } else if (similarity.breakdown.distance > 0.7) {
    reasons.push('地理位置较近');
  }

  return reasons.length > 0 ? reasons.join('、') : '存在潜在重复可能，需人工确认';
}

export const SIMILARITY_THRESHOLDS = {
  AUTO_MERGE: 0.85,
  MANUAL_REVIEW: 0.6,
};
