import { Point, PointStatus } from '@/types';
import { HALL_BOUNDS } from '@/data/points';

const BOUNDARY_THRESHOLD = 0.5;

export function validatePoints(points: Point[]): Point[] {
  const validated = points.map(p => {
    const status = detectStatus(p, points);
    return { ...p, status };
  });
  return validated;
}

function detectStatus(point: Point, allPoints: Point[]): PointStatus {
  if (hasEmptyCoords(point)) return 'empty';
  if (isDuplicate(point, allPoints)) return 'duplicate';
  if (isBoundary(point)) return 'boundary';
  if (point.conflictWithPhoto) return 'error';
  return point.status;
}

function hasEmptyCoords(point: Point): boolean {
  return point.x === null || point.y === null || point.z === null;
}

function isDuplicate(point: Point, allPoints: Point[]): boolean {
  if (point.x === null || point.y === null || point.z === null) return false;
  return allPoints.some(p =>
    p.id !== point.id &&
    p.x === point.x &&
    p.y === point.y &&
    p.z === point.z
  );
}

function isBoundary(point: Point): boolean {
  if (point.x === null || point.y === null || point.z === null) return false;
  const nearX = point.x <= HALL_BOUNDS.minX + BOUNDARY_THRESHOLD || point.x >= HALL_BOUNDS.maxX - BOUNDARY_THRESHOLD;
  const nearY = point.y <= HALL_BOUNDS.minY + BOUNDARY_THRESHOLD || point.y >= HALL_BOUNDS.maxY - BOUNDARY_THRESHOLD;
  const nearZ = point.z <= HALL_BOUNDS.minZ + BOUNDARY_THRESHOLD || point.z >= HALL_BOUNDS.maxZ - BOUNDARY_THRESHOLD;
  return nearX || nearY || nearZ;
}

export function getStatusLabel(status: PointStatus): string {
  const labels: Record<PointStatus, string> = {
    normal: '正常',
    warning: '注意',
    error: '冲突',
    empty: '坐标缺失',
    duplicate: '重复记录',
    boundary: '边界记录'
  };
  return labels[status];
}

export function getStatusFriendlyMessage(point: Point): string {
  switch (point.status) {
    case 'empty':
      return `${point.name} 的坐标没填全，缺了${point.z === null ? 'Z' : ''}值，去翻翻原始记录表看看？`;
    case 'duplicate':
      return `${point.name} 跟别的点位坐标一模一样，是不是导入了两次？`;
    case 'boundary':
      return `${point.name} 快贴墙了，离边界不到0.5米，确认下是不是放错了位置`;
    case 'error':
      return `${point.name} 的坐标跟照片里对不上，你瞅瞅再定`;
    default:
      return '';
  }
}
