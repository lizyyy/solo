import { useMemo } from 'react';
import type { StudentWork, FilterCriteria } from '../types';

export function useFilter(
  works: StudentWork[],
  criteria: FilterCriteria
): StudentWork[] {
  return useMemo(() => {
    return works.filter(work => {
      if (criteria.tags.length > 0 && !criteria.tags.some(t => work.tags.includes(t))) {
        return false;
      }
      if (criteria.mediums.length > 0 && !criteria.mediums.some(m => work.mediums.includes(m))) {
        return false;
      }
      if (work.completion < criteria.minCompletion) {
        return false;
      }
      if (criteria.applicationDirection && !work.applicationDirection.includes(criteria.applicationDirection)) {
        return false;
      }
      return true;
    });
  }, [works, criteria]);
}

export function useTagStats(works: StudentWork[]): Array<{ tag: string; count: number }> {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    works.forEach(work => {
      work.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [works]);
}

export function useMediumStats(works: StudentWork[]): Array<{ medium: string; count: number }> {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    works.forEach(work => {
      work.mediums.forEach(medium => {
        counts[medium] = (counts[medium] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([medium, count]) => ({ medium, count }))
      .sort((a, b) => b.count - a.count);
  }, [works]);
}

export function useCompletionStats(works: StudentWork[]): Array<{ level: number; count: number }> {
  return useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    works.forEach(work => {
      counts[work.completion] = (counts[work.completion] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([level, count]) => ({ level: parseInt(level), count }))
      .sort((a, b) => a.level - b.level);
  }, [works]);
}

export function useDirectionStats(works: StudentWork[]): Array<{ direction: string; count: number }> {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    works.forEach(work => {
      work.applicationDirection.forEach(direction => {
        counts[direction] = (counts[direction] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([direction, count]) => ({ direction, count }))
      .sort((a, b) => b.count - a.count);
  }, [works]);
}
