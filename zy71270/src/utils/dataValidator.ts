import type {
  TrajectoryPoint,
  ChargingStation,
  ChargingQueueItem,
  DataQualityIssue,
  Shelf,
} from '../types';

const BREAKPOINT_TIME_GAP = 30000;
const FLOOR_CONFUSION_TOLERANCE = 0.5;
const FLOOR_HEIGHT = 4;

export function detectBreakpoints(points: TrajectoryPoint[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.robotId !== prev.robotId) continue;

    const timeDiff = curr.timestamp - prev.timestamp;
    if (timeDiff > BREAKPOINT_TIME_GAP) {
      issues.push({
        id: `break-${curr.id}`,
        type: 'trajectory_break',
        severity: 'warning',
        entityType: 'trajectory',
        entityId: curr.id,
        fieldName: 'timestamp',
        description: `相邻轨迹点时间差 ${(timeDiff / 1000).toFixed(1)}秒 超过阈值30秒`,
        canFix: true,
      });
    }
  }

  return issues;
}

export function correctFloorConfusion(points: TrajectoryPoint[]): TrajectoryPoint[] {
  return points.map(point => {
    const z = point.position.z;
    const expectedFloor = Math.round(z / FLOOR_HEIGHT) + 1;
    const zDiff = Math.abs(z - (expectedFloor - 1) * FLOOR_HEIGHT);

    if (zDiff <= FLOOR_CONFUSION_TOLERANCE && point.floor !== expectedFloor) {
      return { ...point, floor: expectedFloor };
    }

    if (point.floor < 1 || point.floor > 3) {
      const correctedFloor = Math.max(1, Math.min(3, expectedFloor));
      if (zDiff <= FLOOR_CONFUSION_TOLERANCE) {
        return { ...point, floor: correctedFloor };
      }
    }

    return point;
  });
}

export function deduplicateChargingQueue(stations: ChargingStation[]): ChargingStation[] {
  return stations.map(station => {
    const seen = new Map<string, ChargingQueueItem>();
    const deduplicated: ChargingQueueItem[] = [];

    for (const item of station.queue) {
      const key = `${item.stationId}-${item.robotId}`;
      const existing = seen.get(key);

      if (existing) {
        deduplicated.push({
          ...item,
          isDuplicate: true,
          deduplicatedFrom: existing.id,
        });
      } else {
        seen.set(key, item);
        deduplicated.push({ ...item, isDuplicate: false });
      }
    }

    return { ...station, queue: deduplicated };
  });
}

export function validateConsistency(
  shelves: Shelf[],
  points: TrajectoryPoint[],
  stations: ChargingStation[]
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  for (const shelf of shelves) {
    if (shelf.isMissingData) {
      issues.push({
        id: `val-missing-${shelf.id}`,
        type: 'missing_field',
        severity: 'error',
        entityType: 'shelf',
        entityId: shelf.id,
        description: `货架 ${shelf.id} 存在数据缺失`,
        canFix: false,
      });
    }

    if (shelf.currentStock < 0) {
      issues.push({
        id: `val-negstock-${shelf.id}`,
        type: 'missing_field',
        severity: 'error',
        entityType: 'shelf',
        entityId: shelf.id,
        fieldName: 'currentStock',
        description: `货架 ${shelf.id} 库存为负数: ${shelf.currentStock}`,
        canFix: false,
      });
    }

    if (shelf.currentStock > shelf.capacity) {
      issues.push({
        id: `val-overcap-${shelf.id}`,
        type: 'missing_field',
        severity: 'warning',
        entityType: 'shelf',
        entityId: shelf.id,
        fieldName: 'currentStock',
        description: `货架 ${shelf.id} 库存(${shelf.currentStock})超过容量(${shelf.capacity})`,
        canFix: false,
      });
    }
  }

  for (const point of points) {
    if (point.floorConfidence < 0.5) {
      issues.push({
        id: `val-floor-${point.id}`,
        type: 'floor_confusion',
        severity: 'warning',
        entityType: 'trajectory',
        entityId: point.id,
        fieldName: 'floorConfidence',
        description: `轨迹点 ${point.id} 楼层置信度过低: ${point.floorConfidence.toFixed(2)}`,
        canFix: true,
      });
    }
  }

  for (const station of stations) {
    const dupes = station.queue.filter(q => q.isDuplicate);
    if (dupes.length > 0) {
      issues.push({
        id: `val-dupqueue-${station.id}`,
        type: 'duplicate_queue',
        severity: 'info',
        entityType: 'charging',
        entityId: station.id,
        description: `充电站 ${station.id} 存在${dupes.length}条重复排队记录`,
        canFix: true,
      });
    }
  }

  return issues;
}
