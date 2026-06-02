import type { Point, MergeSuggestion } from "@/types";

function normalizeChinese(str: string): string {
  return str
    .replace(/[\s\u3000]+/g, "")
    .replace(/[\uff10-\uff19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\uff21-\uff3a]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\uff41-\uff5a]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/学校周边慢行安全/g, "")
    .replace(/学校周边/g, "")
    .replace(/慢行安全/g, "");
}

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

export function computeSimilarity(a: string, b: string): number {
  const na = normalizeChinese(a);
  const nb = normalizeChinese(b);
  return jaroWinkler(na, nb);
}

export interface MergeCheckResult {
  shouldAutoMerge: boolean;
  shouldSuggest: boolean;
  similarity: number;
}

export function checkMerge(
  source: Point,
  target: Point,
  maxAutoDistanceMeters: number = 500
): MergeCheckResult {
  const similarity = computeSimilarity(source.standardName, target.standardName);

  if (similarity < 0.65) {
    return { shouldAutoMerge: false, shouldSuggest: false, similarity };
  }

  if (similarity >= 0.85) {
    if (
      source.latitude != null &&
      source.longitude != null &&
      target.latitude != null &&
      target.longitude != null
    ) {
      const dist = haversine(
        source.latitude,
        source.longitude,
        target.latitude,
        target.longitude
      );
      if (dist > maxAutoDistanceMeters) {
        return { shouldAutoMerge: false, shouldSuggest: true, similarity };
      }
    }
    return { shouldAutoMerge: true, shouldSuggest: false, similarity };
  }

  return { shouldAutoMerge: false, shouldSuggest: true, similarity };
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findMergeSuggestions(
  newPoint: Point,
  existingPoints: Point[]
): MergeSuggestion[] {
  const suggestions: MergeSuggestion[] = [];

  for (const existing of existingPoints) {
    if (existing.id === newPoint.id) continue;
    const result = checkMerge(newPoint, existing);
    if (result.shouldSuggest || result.shouldAutoMerge) {
      suggestions.push({
        id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourcePointId: newPoint.id,
        targetPointId: existing.id,
        similarity: result.similarity,
        status: "pending",
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions.sort((a, b) => b.similarity - a.similarity);
}
