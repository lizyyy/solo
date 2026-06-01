import type { Building, Filters, AnomalyType } from '../data/types';
import { SUNLIGHT_STANDARD } from '../data/types';

export function filterBuildings(
  buildings: Building[],
  filters: Filters
): Building[] {
  return buildings.filter(b => {
    if (filters.district.length > 0 && !filters.district.includes(b.district)) {
      return false;
    }
    if (b.floors < filters.floors[0] || b.floors > filters.floors[1]) {
      return false;
    }
    if (b.sunlightHours !== null) {
      if (
        b.sunlightHours < filters.sunlightHours[0] ||
        b.sunlightHours > filters.sunlightHours[1]
      ) {
        return false;
      }
    }
    if (filters.anomalyType.length > 0) {
      const hasAnomaly = filters.anomalyType.some(
        t => b.anomalies.includes(t as AnomalyType)
      );
      if (!hasAnomaly) return false;
    }
    return true;
  });
}

export interface Statistics {
  total: number;
  withAnomalies: number;
  needsConfirmation: number;
  emptyValues: number;
  boundaryCases: number;
  duplicates: number;
  avgSunlightHours: number | null;
  belowStandard: number;
  aboveStandard: number;
}

export function calculateStatistics(buildings: Building[]): Statistics {
  const total = buildings.length;
  const withAnomalies = buildings.filter(b => b.anomalies.length > 0).length;
  const needsConfirmation = buildings.filter(b =>
    b.anomalies.includes('needs_confirmation')
  ).length;
  const emptyValues = buildings.filter(b => b.sunlightHours === null).length;
  const boundaryCases = buildings.filter(b => b.boundaryCase).length;

  const duplicateMap = new Map<string, number>();
  buildings.forEach(b => {
    b.deviceNames.forEach(name => {
      const normalized = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
      duplicateMap.set(normalized, (duplicateMap.get(normalized) || 0) + 1);
    });
  });
  let duplicates = 0;
  duplicateMap.forEach(count => {
    if (count > 1) duplicates += count;
  });

  const withSunlight = buildings.filter(
    b => b.sunlightHours !== null
  ) as Building[] & { sunlightHours: number }[];
  const avgSunlightHours =
    withSunlight.length > 0
      ? withSunlight.reduce((sum, b) => sum + b.sunlightHours, 0) /
        withSunlight.length
      : null;

  const belowStandard = buildings.filter(
    b => b.sunlightHours !== null && b.sunlightHours < SUNLIGHT_STANDARD
  ).length;
  const aboveStandard = buildings.filter(
    b => b.sunlightHours !== null && b.sunlightHours > SUNLIGHT_STANDARD
  ).length;

  return {
    total,
    withAnomalies,
    needsConfirmation,
    emptyValues,
    boundaryCases,
    duplicates,
    avgSunlightHours,
    belowStandard,
    aboveStandard,
  };
}

export function getBuildingStatus(building: Building): {
  status: 'normal' | 'warning' | 'error' | 'pending';
  label: string;
  color: string;
} {
  if (building.sunlightHours === null) {
    return { status: 'pending', label: '待测算', color: '#95a5a6' };
  }
  if (building.anomalies.includes('cross_floor')) {
    return { status: 'error', label: '跨楼层异常', color: '#ff6b6b' };
  }
  if (building.anomalies.includes('needs_confirmation')) {
    return { status: 'warning', label: '待确认', color: '#ffd93d' };
  }
  if (building.boundaryCase) {
    return { status: 'warning', label: '边界值', color: '#ffd93d' };
  }
  if (building.sunlightHours < SUNLIGHT_STANDARD) {
    return { status: 'warning', label: '低于标准', color: '#ffb347' };
  }
  return { status: 'normal', label: '正常', color: '#2ecc71' };
}
