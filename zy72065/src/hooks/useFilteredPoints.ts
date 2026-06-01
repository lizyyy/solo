import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { MonitoringPoint, DataConflict } from '../types';

export function useFilteredPoints(): MonitoringPoint[] {
  const points = useStore((s) => s.points);
  const filters = useStore((s) => s.filters);
  const searchQuery = useStore((s) => s.searchQuery);

  return useMemo(() => {
    return points.filter((point) => {
      if (!filters.status.includes(point.status)) return false;
      if (!filters.source.includes(point.source)) return false;
      if (
        searchQuery &&
        !point.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !point.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [points, filters, searchQuery]);
}

export function useConflictForPoint(pointId: string): DataConflict | undefined {
  const conflicts = useStore((s) => s.conflicts);
  return useMemo(() => {
    return conflicts.find((c) => c.pointId === pointId);
  }, [conflicts, pointId]);
}
