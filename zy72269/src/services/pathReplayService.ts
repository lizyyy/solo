import type { InspectionMark, PathPoint } from '@/types';
import { calculateDistance } from '@/utils/coordinate';
import { generateUUID } from '@/utils/coordinate';

export function generatePathPoints(marks: InspectionMark[]): PathPoint[] {
  const sortedMarks = [...marks].sort((a, b) => a.sequenceNo - b.sequenceNo);

  return sortedMarks.map((mark, index) => ({
    x: mark.x,
    y: mark.y,
    z: mark.z,
    sequenceNo: mark.sequenceNo,
    markId: mark.id,
    isObstacle: mark.isObstacle,
    timestamp: new Date(Date.now() + index * 1000).toISOString()
  }));
}

export function getPathSegments(pathPoints: PathPoint[]): Array<{
  start: PathPoint;
  end: PathPoint;
  distance: number;
  hasObstacle: boolean;
}> {
  const segments: Array<{
    start: PathPoint;
    end: PathPoint;
    distance: number;
    hasObstacle: boolean;
  }> = [];

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const start = pathPoints[i];
    const end = pathPoints[i + 1];
    segments.push({
      start,
      end,
      distance: calculateDistance(start, end),
      hasObstacle: start.isObstacle || end.isObstacle
    });
  }

  return segments;
}

export function interpolatePath(pathPoints: PathPoint[], steps: number = 100): PathPoint[] {
  if (pathPoints.length < 2) return pathPoints;

  const interpolated: PathPoint[] = [];
  const segments = getPathSegments(pathPoints);
  const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0);

  let accumulatedDistance = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentSteps = Math.max(1, Math.round((segment.distance / totalDistance) * steps));

    for (let j = 0; j <= segmentSteps; j++) {
      const t = j / segmentSteps;
      interpolated.push({
        x: segment.start.x + (segment.end.x - segment.start.x) * t,
        y: segment.start.y + (segment.end.y - segment.start.y) * t,
        z: segment.start.z + (segment.end.z - segment.start.z) * t,
        sequenceNo: segment.start.sequenceNo,
        markId: t < 0.5 ? segment.start.markId : segment.end.markId,
        isObstacle: segment.hasObstacle,
        timestamp: new Date(Date.now() + accumulatedDistance + t * segment.distance * 100).toISOString()
      });
      accumulatedDistance += segment.distance / segmentSteps;
    }
  }

  return interpolated;
}

export function recalculatePath(marks: InspectionMark[]): {
  points: PathPoint[];
  totalLength: number;
  obstacleCount: number;
} {
  const points = generatePathPoints(marks);
  const segments = getPathSegments(points);
  const totalLength = segments.reduce((sum, s) => sum + s.distance, 0);
  const obstacleCount = marks.filter(m => m.isObstacle).length;

  return {
    points,
    totalLength,
    obstacleCount
  };
}

export function compareVersions(
  marksA: InspectionMark[],
  marksB: InspectionMark[]
): {
  added: InspectionMark[];
  removed: InspectionMark[];
  modified: InspectionMark[];
  totalChanges: number;
} {
  const mapA = new Map(marksA.map(m => [m.sequenceNo, m]));
  const mapB = new Map(marksB.map(m => [m.sequenceNo, m]));

  const added: InspectionMark[] = [];
  const removed: InspectionMark[] = [];
  const modified: InspectionMark[] = [];

  for (const [seqNo, markB] of mapB) {
    const markA = mapA.get(seqNo);
    if (!markA) {
      added.push(markB);
    } else if (JSON.stringify(markA) !== JSON.stringify(markB)) {
      modified.push(markB);
    }
  }

  for (const [seqNo, markA] of mapA) {
    if (!mapB.has(seqNo)) {
      removed.push(markA);
    }
  }

  return {
    added,
    removed,
    modified,
    totalChanges: added.length + removed.length + modified.length
  };
}

export function getHistoricalVersions(taskId: string): Array<{
  version: number;
  timestamp: string;
  markCount: number;
  description: string;
}> {
  return [
    { version: 1, timestamp: new Date(Date.now() - 86400000).toISOString(), markCount: 10, description: '首次导入' },
    { version: 2, timestamp: new Date(Date.now() - 43200000).toISOString(), markCount: 12, description: '补录数据' },
    { version: 3, timestamp: new Date().toISOString(), markCount: 12, description: '冲突处理后' }
  ];
}
