import { useMemo } from 'react';
import { useRecordStore } from '../store/useRecordStore';
import type { Statistics, BuoyRecord } from '../types';

export function useStatistics(): Statistics {
  const records = useRecordStore(s => s.records);

  return useMemo(() => {
    const distribution: { level: number; count: number }[] = [];
    for (let i = 0; i <= 9; i++) {
      distribution.push({ level: i, count: 0 });
    }
    records.forEach(r => {
      if (r.seaState >= 0 && r.seaState <= 9) {
        distribution[r.seaState].count++;
      }
    });
    return {
      total: records.length,
      pending: records.filter(r => r.status === 'pending').length,
      reviewed: records.filter(r => r.status === 'reviewed').length,
      anomaly: records.filter(r => r.isAnomaly).length,
      boundary: records.filter(r => r.isBoundary).length,
      cloudOccluded: records.filter(r => r.isCloudOccluded).length,
      seaStateDistribution: distribution,
    };
  }, [records]);
}

export function useFilteredRecords(): BuoyRecord[] {
  const records = useRecordStore(s => s.records);
  const filters = useRecordStore(s => s.filters);

  return useMemo(() => {
    return records.filter(r => {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.seaState !== undefined && r.seaState !== filters.seaState) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.buoyId.toLowerCase().includes(s) &&
            !r.rawLogEntry.logPage.toLowerCase().includes(s) &&
            !String(r.seaState).includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [records, filters]);
}

export function useBoundaryRecords(): BuoyRecord[] {
  const records = useRecordStore(s => s.records);
  return useMemo(() => records.filter(r => r.isBoundary), [records]);
}

export function useCloudOccludedRecords(): BuoyRecord[] {
  const records = useRecordStore(s => s.records);
  return useMemo(() => records.filter(r => r.isCloudOccluded), [records]);
}

export function useAnomalyRecords(): BuoyRecord[] {
  const records = useRecordStore(s => s.records);
  return useMemo(() => records.filter(r => r.isAnomaly), [records]);
}
