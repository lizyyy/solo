import type {
  PipelineSegment,
  CollisionPoint,
  CollisionType,
  CollisionSeverity,
  DetectionConfig,
  DataIssue,
} from '../types';
import { segmentDistance, getRequiredDistance } from './distance';
import { estimatePileNoAtPoint } from './pileNo';
import { validateAndCorrectPipelineData, findElevationAnomalies } from './dataValidator';
import { logger } from '../utils/logger';

export interface CollisionDetectionResult {
  collisions: CollisionPoint[];
  dataIssues: DataIssue[];
  correctedCount: number;
  skippedCount: number;
  duration: number;
  totalSegments: number;
  checkedPairs: number;
}

function getCollisionType(
  segA: PipelineSegment,
  segB: PipelineSegment,
  isIntersecting: boolean,
  minDistance: number,
  requiredDistance: number
): CollisionType {
  if (isIntersecting) return 'intersect';
  if (segA.dataSource === 'duplicate' || segB.dataSource === 'duplicate') return 'duplicate';
  if (segA.diameter <= 0 || segB.diameter <= 0) return 'missing';
  if (minDistance < requiredDistance) return 'distance';
  return 'intersect';
}

function getSeverity(
  type: CollisionType,
  minDistance: number,
  requiredDistance: number
): CollisionSeverity {
  if (type === 'intersect') return 'critical';
  if (type === 'duplicate') return 'critical';
  if (type === 'missing') return 'warning';

  const ratio = minDistance / requiredDistance;
  if (ratio < 0.3) return 'critical';
  if (ratio < 0.7) return 'warning';
  return 'info';
}

function isSameSegment(segA: PipelineSegment, segB: PipelineSegment): boolean {
  return segA.id === segB.id;
}

function shouldCheckPair(segA: PipelineSegment, segB: PipelineSegment): boolean {
  if (isSameSegment(segA, segB)) return false;
  if (segA.diameter <= 0 || segB.diameter <= 0) return false;

  const boundsA = {
    minX: Math.min(segA.startPoint.x, segA.endPoint.x),
    maxX: Math.max(segA.startPoint.x, segA.endPoint.x),
    minY: Math.min(segA.startPoint.y, segA.endPoint.y),
    maxY: Math.max(segA.startPoint.y, segA.endPoint.y),
    minZ: Math.min(segA.startPoint.z, segA.endPoint.z),
    maxZ: Math.max(segA.startPoint.z, segA.endPoint.z),
  };

  const boundsB = {
    minX: Math.min(segB.startPoint.x, segB.endPoint.x),
    maxX: Math.max(segB.startPoint.x, segB.endPoint.x),
    minY: Math.min(segB.startPoint.y, segB.endPoint.y),
    maxY: Math.max(segB.startPoint.y, segB.endPoint.y),
    minZ: Math.min(segB.startPoint.z, segB.endPoint.z),
    maxZ: Math.max(segB.startPoint.z, segB.endPoint.z),
  };

  const margin = 5;
  return (
    boundsA.minX - margin <= boundsB.maxX &&
    boundsA.maxX + margin >= boundsB.minX &&
    boundsA.minY - margin <= boundsB.maxY &&
    boundsA.maxY + margin >= boundsB.minY &&
    boundsA.minZ - margin <= boundsB.maxZ &&
    boundsA.maxZ + margin >= boundsB.minZ
  );
}

export function detectCollisions(
  segments: PipelineSegment[],
  config: DetectionConfig
): CollisionDetectionResult {
  const startTime = performance.now();
  logger.info('collision', '开始碰撞检测', { segmentCount: segments.length });

  const validation = validateAndCorrectPipelineData(segments, config);
  const validSegments = validation.segments.filter(
    (seg) => seg.diameter > 0 && Math.abs(seg.startPoint.y) < 100 && Math.abs(seg.endPoint.y) < 100
  );

  const collisions: CollisionPoint[] = [];
  const checkedPairs = new Set<string>();
  let pairCount = 0;

  const elevationIssues = findElevationAnomalies(validSegments, config.elevationTolerance);
  const allDataIssues = [...validation.issues, ...elevationIssues];

  for (let i = 0; i < validSegments.length; i++) {
    for (let j = i + 1; j < validSegments.length; j++) {
      const segA = validSegments[i];
      const segB = validSegments[j];

      const pairKey = [segA.id, segB.id].sort().join('-');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      if (!shouldCheckPair(segA, segB)) continue;
      pairCount++;

      const distanceResult = segmentDistance(segA, segB);
      const requiredDistance = getRequiredDistance(segA.type, segB.type, config);

      if (distanceResult.minDistance < requiredDistance || distanceResult.isIntersecting) {
        const collisionType = getCollisionType(
          segA,
          segB,
          distanceResult.isIntersecting,
          distanceResult.minDistance,
          requiredDistance
        );

        const severity = getSeverity(
          collisionType,
          distanceResult.minDistance,
          requiredDistance
        );

        const dataIssues: DataIssue[] = [];
        if (segA.hasWarning) {
          dataIssues.push({
            type: segA.warningMessage?.includes('单位') ? 'unit_error' : 'missing',
            description: segA.warningMessage || '',
            originalValue: segA.id,
            impact: '数据异常可能影响碰撞检测的准确性',
          });
        }
        if (segB.hasWarning) {
          dataIssues.push({
            type: segB.warningMessage?.includes('单位') ? 'unit_error' : 'missing',
            description: segB.warningMessage || '',
            originalValue: segB.id,
            impact: '数据异常可能影响碰撞检测的准确性',
          });
        }

        const collision: CollisionPoint = {
          id: `col-${Date.now()}-${i}-${j}`,
          type: collisionType,
          severity,
          segmentA: segA,
          segmentB: segB,
          position: distanceResult.midPoint,
          calculatedDistance: distanceResult.minDistance,
          requiredDistance,
          pileNo: estimatePileNoAtPoint(distanceResult.midPoint, validSegments),
          status: 'pending',
          createdAt: new Date().toISOString(),
          dataIssues,
        };

        collisions.push(collision);
        logger.info('collision', `发现碰撞: ${collisionType}`, {
          id: collision.id,
          severity,
          distance: distanceResult.minDistance,
          required: requiredDistance,
          pileNo: collision.pileNo,
        });
      }
    }
  }

  const duration = performance.now() - startTime;

  logger.info('collision', '碰撞检测完成', {
    totalSegments: segments.length,
    validSegments: validSegments.length,
    collisions: collisions.length,
    pairsChecked: pairCount,
    dataIssues: allDataIssues.length,
    duration: `${duration.toFixed(0)}ms`,
  });

  return {
    collisions,
    dataIssues: allDataIssues,
    correctedCount: validation.correctedCount,
    skippedCount: validation.skippedCount,
    duration,
    totalSegments: segments.length,
    checkedPairs: pairCount,
  };
}
