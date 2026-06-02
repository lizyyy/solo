import { GISPoint, ResidentFeedback, InspectionRecord, MergedRecord, MatchConfidence } from '@/types';

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
  if (!a || !b) return 0;
  const aClean = a.toLowerCase().trim();
  const bClean = b.toLowerCase().trim();
  const maxLen = Math.max(aClean.length, bClean.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(aClean, bClean);
  return (maxLen - distance) / maxLen;
}

export function calculateDistance(
  lat1: number, lon1: number, 
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function calculateMatchScore(
  lampId1: string, lampId2: string,
  addr1: string, addr2: string,
  lat1?: number, lon1?: number,
  lat2?: number, lon2?: number
): number {
  let score = 0;
  
  if (lampId1 && lampId2 && lampId1.trim() === lampId2.trim()) {
    score += 50;
  }
  
  const addrSimilarity = stringSimilarity(addr1, addr2);
  score += addrSimilarity * 30;
  
  if (lat1 !== undefined && lon1 !== undefined && 
      lat2 !== undefined && lon2 !== undefined) {
    const dist = calculateDistance(lat1, lon1, lat2, lon2);
    if (dist <= 10) {
      score += 20;
    } else if (dist <= 30) {
      score += 15;
    } else if (dist <= 50) {
      score += 10;
    } else if (dist <= 100) {
      score += 5;
    }
  }
  
  return score;
}

export function getConfidenceFromScore(score: number): MatchConfidence {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
