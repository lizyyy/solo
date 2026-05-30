import {
  Misnote,
  FilterCriteria,
  MisnoteStatistics,
  ProblemType,
  ConfirmationStatus,
} from '@/types';

export class MisnoteAnalyzer {
  analyze(
    misnotes: Misnote[],
    filters: FilterCriteria
  ): MisnoteStatistics {
    const filtered = this.applyFilters(misnotes, filters);

    const byProblemType: Record<ProblemType, number> = {
      voice_overlap: 0,
      section_misalignment: 0,
      noise_misjudgment: 0,
    };

    const byVoicePart: Record<string, number> = {};
    const byConfirmationStatus: Record<ConfirmationStatus, number> = {
      pending: 0,
      confirmed: 0,
      rejected: 0,
    };

    const deviationRanges = [
      { range: '0-50 音分', min: 0, max: 50, count: 0 },
      { range: '50-100 音分', min: 50, max: 100, count: 0 },
      { range: '100-200 音分', min: 100, max: 200, count: 0 },
      { range: '200-500 音分', min: 200, max: 500, count: 0 },
      { range: '500+ 音分', min: 500, max: Infinity, count: 0 },
    ];

    const timeBuckets: Map<number, number> = new Map();
    const bucketSize = 10;

    for (const misnote of filtered) {
      byProblemType[misnote.problemType]++;

      byVoicePart[misnote.voicePartId] = (byVoicePart[misnote.voicePartId] || 0) + 1;

      byConfirmationStatus[misnote.confirmationStatus]++;

      for (const range of deviationRanges) {
        if (misnote.deviationCents >= range.min && misnote.deviationCents < range.max) {
          range.count++;
          break;
        }
      }

      const bucketKey = Math.floor(misnote.time / bucketSize) * bucketSize;
      timeBuckets.set(bucketKey, (timeBuckets.get(bucketKey) || 0) + 1);
    }

    const timeDistribution = Array.from(timeBuckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, count]) => ({ time, count }));

    return {
      total: filtered.length,
      byProblemType,
      byVoicePart,
      byConfirmationStatus,
      byDeviationRange: deviationRanges.map((r) => ({
        range: r.range,
        count: r.count,
      })),
      timeDistribution,
    };
  }

  applyFilters(
    misnotes: Misnote[],
    filters: FilterCriteria
  ): Misnote[] {
    return misnotes.filter((m) => {
      if (filters.voicePartIds.length > 0 && !filters.voicePartIds.includes(m.voicePartId)) {
        return false;
      }

      if (filters.problemTypes.length > 0 && !filters.problemTypes.includes(m.problemType)) {
        return false;
      }

      if (
        filters.confirmationStatuses.length > 0 &&
        !filters.confirmationStatuses.includes(m.confirmationStatus)
      ) {
        return false;
      }

      if (filters.sourceTypes.length > 0 && !filters.sourceTypes.includes(m.sourceType)) {
        return false;
      }

      if (filters.timeRange) {
        const [start, end] = filters.timeRange;
        if (m.time < start || m.time > end) {
          return false;
        }
      }

      if (m.confidence < filters.minConfidence) {
        return false;
      }

      if (m.deviationCents > filters.maxDeviation) {
        return false;
      }

      return true;
    });
  }

  compare(
    before: Misnote[],
    after: Misnote[],
    filters: FilterCriteria
  ): {
    added: Misnote[];
    removed: Misnote[];
    changed: Misnote[];
    beforeStats: MisnoteStatistics;
    afterStats: MisnoteStatistics;
  } {
    const beforeFiltered = this.applyFilters(before, filters);
    const afterFiltered = this.applyFilters(after, filters);

    const beforeMap = new Map(beforeFiltered.map((m) => [m.id, m]));
    const afterMap = new Map(afterFiltered.map((m) => [m.id, m]));

    const added: Misnote[] = [];
    const removed: Misnote[] = [];
    const changed: Misnote[] = [];

    for (const m of afterFiltered) {
      if (!beforeMap.has(m.id)) {
        added.push(m);
      } else {
        const beforeM = beforeMap.get(m.id)!;
        if (
          beforeM.confirmationStatus !== m.confirmationStatus ||
          beforeM.problemType !== m.problemType ||
          Math.abs(beforeM.deviationCents - m.deviationCents) > 1
        ) {
          changed.push(m);
        }
      }
    }

    for (const m of beforeFiltered) {
      if (!afterMap.has(m.id)) {
        removed.push(m);
      }
    }

    return {
      added,
      removed,
      changed,
      beforeStats: this.analyze(before, filters),
      afterStats: this.analyze(after, filters),
    };
  }
}

export const misnoteAnalyzer = new MisnoteAnalyzer();
