import type { Point } from '@/types';

const SYNONYMS: Record<string, string[]> = {
  '路口': ['交叉口', '拐角', '路口', '交叉路口'],
  '交叉口': ['路口', '拐角', '交叉路口'],
  '与': ['和', '跟', '同'],
};

export function normalizeName(name: string): string {
  let normalized = name.replace(/[\s\-_，。、]/g, '');
  normalized = normalized.replace(/[0-9]/g, '');
  for (const [standard, synonyms] of Object.entries(SYNONYMS)) {
    for (const synonym of synonyms) {
      normalized = normalized.replace(new RegExp(synonym, 'g'), standard);
    }
  }
  return normalized;
}

export function calculateJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

export function calculateEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
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
  return matrix[str1.length][str2.length];
}

export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  const jaccard = calculateJaccardSimilarity(norm1, norm2);
  const editDist = calculateEditDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  const editSimilarity = 1 - editDist / maxLen;
  return (jaccard + editSimilarity) / 2;
}

export function calculateCoordinateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function shouldMerge(p1: Point, p2: Point): boolean {
  if (p1.id === p2.id) return false;
  const similarity = calculateNameSimilarity(p1.name, p2.name);
  const distance = calculateCoordinateDistance(
    p1.coordinates.lat,
    p1.coordinates.lng,
    p2.coordinates.lat,
    p2.coordinates.lng
  );
  if (similarity > 0.85 && distance < 200) return true;
  const p1NameInP2Aliases = p2.aliases.some(a =>
    calculateNameSimilarity(p1.name, a) > 0.85
  );
  const p2NameInP1Aliases = p1.aliases.some(a =>
    calculateNameSimilarity(p2.name, a) > 0.85
  );
  if ((p1NameInP2Aliases || p2NameInP1Aliases) && distance < 200) return true;
  if (p1.mergedFrom?.includes(p2.id) || p2.mergedFrom?.includes(p1.id)) {
    if (distance < 200) return true;
  }
  return false;
}

export function findMergeCandidates(points: Point[]): Point[][] {
  const candidates: Point[][] = [];
  const processed = new Set<string>();
  const allPoints = [...points];

  for (let i = 0; i < allPoints.length; i++) {
    if (processed.has(allPoints[i].id)) continue;
    const group: Point[] = [allPoints[i]];
    processed.add(allPoints[i].id);
    for (let j = i + 1; j < allPoints.length; j++) {
      if (processed.has(allPoints[j].id)) continue;
      if (shouldMerge(allPoints[i], allPoints[j])) {
        group.push(allPoints[j]);
        processed.add(allPoints[j].id);
      }
    }
    if (group.length > 1) {
      const hasUnmerged = group.some(p => !p.isMerged);
      if (hasUnmerged) {
        const mergedMasters = allPoints.filter(p =>
          p.isMerged &&
          !processed.has(p.id) &&
          group.some(gp => shouldMerge(gp, p))
        );
        for (const master of mergedMasters) {
          group.push(master);
          processed.add(master.id);
        }
      }
      candidates.push(group);
    }
  }
  return candidates;
}

export function isAdjacentPoint(point1: Point, point2: Point): boolean {
  const distance = calculateCoordinateDistance(
    point1.coordinates.lat,
    point1.coordinates.lng,
    point2.coordinates.lat,
    point2.coordinates.lng
  );
  const similarity = calculateNameSimilarity(point1.name, point2.name);
  return distance >= 50 && distance < 200 && similarity > 0.6;
}

const STATUS_PRIORITY: Record<string, number> = {
  completed: 5,
  verified: 4,
  processing: 3,
  pending: 2,
  review: 1,
};

export function mergePoints(points: Point[], targetName: string): Point {
  if (points.length < 2) {
    throw new Error('需要至少两个点位才能合并');
  }
  const aliases = [...new Set(points.flatMap(p => [p.name, ...p.aliases]))];
  const avgLat = points.reduce((sum, p) => sum + p.coordinates.lat, 0) / points.length;
  const avgLng = points.reduce((sum, p) => sum + p.coordinates.lng, 0) / points.length;
  const timePeriods = [...new Set(points.flatMap(p => p.timePeriods))];
  const mergedFrom = [...new Set(points.flatMap(p => [p.id, ...(p.mergedFrom || [])]))];
  const sortedByStatus = [...points].sort((a, b) =>
    (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0)
  );
  const bestStatus = sortedByStatus[0].status;
  const hasOffset = points.some(p => p.coordinates.offset);
  const isAdjacent = points.some(p => p.isAdjacent);
  const adjacentPointIds = [...new Set(points.flatMap(p => p.adjacentPointIds || []))];
  const now = new Date().toISOString();
  const earliestCreatedAt = points.reduce((earliest, p) =>
    p.createdAt < earliest ? p.createdAt : earliest, points[0].createdAt);
  const latestUpdatedAt = points.reduce((latest, p) =>
    (p.updatedAt || p.createdAt) > latest ? (p.updatedAt || p.createdAt) : latest, points[0].updatedAt || points[0].createdAt);
  const basePoint = sortedByStatus[0];
  return {
    id: `merged-${Date.now()}`,
    name: targetName,
    aliases: aliases.filter(a => a !== targetName),
    address: basePoint.address,
    coordinates: hasOffset ? {
      lat: avgLat,
      lng: avgLng,
      offset: true,
      originalLat: basePoint.coordinates.originalLat || basePoint.coordinates.lat,
      originalLng: basePoint.coordinates.originalLng || basePoint.coordinates.lng,
    } : {
      lat: avgLat,
      lng: avgLng,
    },
    status: bestStatus,
    isMerged: true,
    mergedFrom,
    isAdjacent,
    adjacentPointIds: adjacentPointIds.length > 0 ? adjacentPointIds : undefined,
    timePeriods,
    createdAt: earliestCreatedAt,
    updatedAt: latestUpdatedAt > now ? latestUpdatedAt : now,
  };
}
