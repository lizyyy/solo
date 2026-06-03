import { RangefinderRecord, Point3D } from '../types';
import { generateRangefinderId } from '../utils/idGenerator';

export function createRangefinderRecord(params: {
  obstructionId: string;
  measuredBy: string;
  distance: number;
  fromPoint: Point3D;
  toPoint: Point3D;
  notes?: string;
  accuracy?: number;
}): RangefinderRecord {
  return {
    id: generateRangefinderId(),
    obstructionId: params.obstructionId,
    measuredAt: Date.now(),
    measuredBy: params.measuredBy,
    distance: params.distance,
    fromPoint: params.fromPoint,
    toPoint: params.toPoint,
    notes: params.notes,
    accuracy: params.accuracy ?? 0.01
  };
}

export function calculateDistance(from: Point3D, to: Point3D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function validateRangefinderRecord(record: RangefinderRecord): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!record.obstructionId) {
    errors.push('缺少障碍物ID');
  }

  if (!record.measuredBy) {
    errors.push('缺少测量人员信息');
  }

  if (record.distance <= 0) {
    errors.push('测量距离必须大于0');
  }

  const calculatedDistance = calculateDistance(record.fromPoint, record.toPoint);
  const tolerance = record.accuracy ?? 0.01;

  if (Math.abs(calculatedDistance - record.distance) > tolerance) {
    errors.push(
      `记录距离(${record.distance.toFixed(2)}m)与坐标计算距离(${calculatedDistance.toFixed(2)}m)不符，误差超过${tolerance}m`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
