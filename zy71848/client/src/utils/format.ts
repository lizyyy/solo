import type { CoordinateData, Point } from '../../../shared/types';

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待确认',
    approved: '已通过',
    exception: '有异常',
    material_only: '仅补材料',
  };
  return labels[status] || status;
}

export function getChangeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    route_early: '讲解路线早到',
    note_late: '设备备注晚补',
    cad_manual: 'CAD点位改动',
    flip: '坐标轴翻转',
    export: '导出记录',
  };
  return labels[type] || type;
}

export function getChangeTypeColor(type: string): string {
  const colors: Record<string, string> = {
    route_early: '#10B981',
    note_late: '#6B7280',
    cad_manual: '#EF4444',
    flip: '#F59E0B',
    export: '#1E40AF',
  };
  return colors[type] || '#6B7280';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#F59E0B',
    approved: '#10B981',
    exception: '#EF4444',
    material_only: '#6B7280',
  };
  return colors[status] || '#6B7280';
}

export function getStatusBgClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    exception: 'bg-red-100 text-red-800 border-red-300',
    material_only: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return classes[status] || 'bg-gray-100 text-gray-800 border-gray-300';
}

export function simplifyNumber(num: number, decimals = 2): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function flipCoordinates(
  coordinates: CoordinateData,
  flipType: 'x' | 'y' | 'origin'
): { flipped: CoordinateData; deviation: number } {
  const flipped = JSON.parse(JSON.stringify(coordinates)) as CoordinateData;

  flipped.points = flipped.points.map((p) => {
    const np = { ...p };
    switch (flipType) {
      case 'x':
        np.y = -np.y + 2 * coordinates.centerY;
        break;
      case 'y':
        np.x = -np.x + 2 * coordinates.centerX;
        break;
      case 'origin':
        np.x = -np.x + 2 * coordinates.centerX;
        np.y = -np.y + 2 * coordinates.centerY;
        break;
    }
    return np;
  });

  const deviation = calculateDeviation(coordinates, flipped);

  return { flipped, deviation };
}

export function calculateDeviation(orig: CoordinateData, flipped: CoordinateData): number {
  if (orig.points.length === 0) return 0;
  let totalDist = 0;
  orig.points.forEach((p, i) => {
    const fp = flipped.points[i];
    if (fp) {
      totalDist += Math.sqrt(Math.pow(p.x - fp.x, 2) + Math.pow(p.y - fp.y, 2));
    }
  });
  return Math.round((totalDist / orig.points.length) / 100);
}

export function calculateContentHash(data: unknown): string {
  const content = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 16);
}

export function pointsToSvgPath(points: Point[], width: number, height: number): string {
  if (points.length === 0) return '';
  const scaleX = width / 600;
  const scaleY = height / 600;
  return points
    .map((p, i) => {
      const x = p.x * scaleX;
      const y = p.y * scaleY;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function getPointTypeColor(type: string): string {
  const colors: Record<string, string> = {
    cad: '#3B82F6',
    route: '#10B981',
    device: '#8B5CF6',
  };
  return colors[type] || '#6B7280';
}
