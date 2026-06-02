import { Point, MergeGroup } from '../types';
import {
  stringSimilarity,
  haversineDistance,
  normalizeName,
  normalizeAddress,
} from './similarity';

export interface MatchResult {
  point1: Point;
  point2: Point;
  nameSimilarity: number;
  addressSimilarity: number;
  distance: number;
  overallSimilarity: number;
}

export function calculateMatchScore(point1: Point, point2: Point): MatchResult {
  const normName1 = normalizeName(point1.name);
  const normName2 = normalizeName(point2.name);
  const nameSimilarity = stringSimilarity(normName1, normName2);

  const normAddr1 = normalizeAddress(point1.address);
  const normAddr2 = normalizeAddress(point2.address);
  const addressSimilarity = stringSimilarity(normAddr1, normAddr2);

  const distance = haversineDistance(
    point1.lat,
    point1.lng,
    point2.lat,
    point2.lng
  );

  const distanceScore = Math.max(0, 1 - distance / 500);

  const overallSimilarity =
    nameSimilarity * 0.5 + addressSimilarity * 0.3 + distanceScore * 0.2;

  return {
    point1,
    point2,
    nameSimilarity,
    addressSimilarity,
    distance,
    overallSimilarity,
  };
}

export function findMergeGroups(
  points: Point[],
  threshold: number = 0.7
): MergeGroup[] {
  const groups: MergeGroup[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < points.length; i++) {
    if (usedIds.has(points[i].id)) continue;

    const groupPoints: Point[] = [points[i]];
    let highestNameSim = 0;
    let highestAddrSim = 0;
    let lowestDistance = Infinity;

    for (let j = i + 1; j < points.length; j++) {
      if (usedIds.has(points[j].id)) continue;

      const match = calculateMatchScore(points[i], points[j]);

      if (match.overallSimilarity >= threshold) {
        groupPoints.push(points[j]);
        usedIds.add(points[j].id);

        highestNameSim = Math.max(highestNameSim, match.nameSimilarity);
        highestAddrSim = Math.max(highestAddrSim, match.addressSimilarity);
        lowestDistance = Math.min(lowestDistance, match.distance);
      }
    }

    if (groupPoints.length > 1) {
      const primaryPoint = groupPoints.find((p) => p.source === 'gis') || groupPoints[0];

      groups.push({
        id: `group-${Date.now()}-${i}`,
        points: groupPoints,
        similarity: groupPoints.reduce((acc, _, idx) => {
          if (idx === 0) return 0;
          const match = calculateMatchScore(groupPoints[0], groupPoints[idx]);
          return Math.max(acc, match.overallSimilarity);
        }, 0),
        nameSimilarity: highestNameSim,
        addressSimilarity: highestAddrSim,
        distance: lowestDistance === Infinity ? 0 : lowestDistance,
        confirmed: false,
        rejected: false,
        mergedName: primaryPoint.name,
        mergedAddress: primaryPoint.address,
      });
    }

    usedIds.add(points[i].id);
  }

  return groups.sort((a, b) => b.similarity - a.similarity);
}

export function mergePoints(
  group: MergeGroup,
  mergedName: string,
  mergedAddress: string
): Point {
  const gisPoint = group.points.find((p) => p.source === 'gis');
  const primaryPoint = gisPoint || group.points[0];

  const allFeedbacks = group.points.flatMap((p) => p.feedbacks);
  const allPhotos = group.points.flatMap((p) => p.photos);
  const allHistory = group.points.flatMap((p) => p.history);

  const conflicts = detectConflicts(group.points);

  return {
    ...primaryPoint,
    id: `merged-${Date.now()}`,
    name: mergedName,
    address: mergedAddress,
    status: 'pending' as const,
    feedbacks: allFeedbacks,
    photos: allPhotos,
    history: [
      ...allHistory,
      {
        id: `hist-${Date.now()}`,
        pointId: `merged-${Date.now()}`,
        action: 'merge',
        operator: '系统',
        timestamp: new Date().toISOString(),
        remark: `归并了 ${group.points.length} 个点位: ${group.points.map((p) => p.name).join(', ')}`,
      },
    ],
    conflicts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function detectConflicts(points: Point[]) {
  const conflicts = [];
  const gisPoint = points.find((p) => p.source === 'gis');

  if (!gisPoint) return [];

  for (const point of points) {
    if (point.source === 'gis') continue;

    if (point.name !== gisPoint.name) {
      conflicts.push({
        type: 'name' as const,
        gisValue: gisPoint.name,
        importValue: point.name,
        suggestion: '建议以GIS数据为准，如居民反馈有补充可在备注中说明',
        resolved: false,
      });
    }

    if (point.address !== gisPoint.address) {
      conflicts.push({
        type: 'address' as const,
        gisValue: gisPoint.address,
        importValue: point.address,
        suggestion: '建议核对地址后选择最准确的描述',
        resolved: false,
      });
    }

    if (point.category !== gisPoint.category) {
      conflicts.push({
        type: 'category' as const,
        gisValue: gisPoint.category,
        importValue: point.category,
        suggestion: '建议根据实际情况确认点位类别',
        resolved: false,
      });
    }
  }

  return conflicts;
}
