import type {
  ScheduleVersion, ScheduleAggregate, ScheduleStatus,
  ChangeHistoryItem, EvidenceItem,
} from '../types/schedule';

export function buildBizKey(pipelineNo: string, partModel: string, cycleId: string = 'CYCLE-2026-H1'): string {
  return `${pipelineNo}__${partModel}__${cycleId}`;
}

export function extractBizKeyFromVersion(v: ScheduleVersion): string {
  return buildBizKey(v.pipelineNo, v.partModel);
}

export function dedupAndAggregate(
  versions: ScheduleVersion[],
  histories: ChangeHistoryItem[] = [],
  evidences: EvidenceItem[] = [],
): ScheduleAggregate[] {
  const map = new Map<string, ScheduleVersion[]>();
  for (const v of versions) {
    const key = extractBizKeyFromVersion(v);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(v);
  }

  const result: ScheduleAggregate[] = [];
  for (const [bizKey, group] of map.entries()) {
    const sorted = [...group].sort((a, b) => b.version - a.version);
    const nonWithdrawn = sorted.filter(v => v.status !== 'withdrawn');
    const latest = nonWithdrawn.length > 0 ? nonWithdrawn[0] : sorted[0];
    const withdrawnCount = sorted.filter(v => v.status === 'withdrawn').length;

    const versionIds = new Set(sorted.map(v => v.id));
    const changeHistory = histories
      .filter(h => versionIds.has(h.scheduleId))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const linkedEvidences = evidences.filter(e => e.bizKey === bizKey);

    result.push({
      bizKey,
      latest,
      versions: sorted,
      changeHistory,
      evidences: linkedEvidences,
      withdrawnCount,
    });
  }

  return result.sort((a, b) => {
    const pa = statusSortPriority(a.latest.status, a.latest.modelReplace ? 1 : 0);
    const pb = statusSortPriority(b.latest.status, b.latest.modelReplace ? 1 : 0);
    if (pa !== pb) return pa - pb;
    return b.latest.submittedAt.localeCompare(a.latest.submittedAt);
  });
}

function statusSortPriority(status: ScheduleStatus, modelReplaceFlag: number): number {
  switch (status) {
    case 'pending': return 0;
    case 'draft': return 1;
    case 'withdrawn': return 2;
    case 'confirmed': return 3;
    default: return 4;
  }
}

export function countByStatus(aggs: ScheduleAggregate[]): Record<ScheduleStatus, number> {
  const result: Record<ScheduleStatus, number> = {
    confirmed: 0,
    pending: 0,
    withdrawn: 0,
    draft: 0,
  };
  for (const agg of aggs) {
    result[agg.latest.status]++;
  }
  return result;
}

export function isHandoverReady(a: ScheduleAggregate): boolean {
  if (a.latest.status === 'withdrawn') return false;
  if (a.latest.status !== 'confirmed') return false;
  return a.evidences.length === 0 || a.evidences.every(e => e.confirmed);
}

export function hasPendingEvidence(a: ScheduleAggregate): boolean {
  return a.evidences.some(e => !e.confirmed);
}

export function splitForHandover(aggs: ScheduleAggregate[]): { confirmed: ScheduleAggregate[]; pending: ScheduleAggregate[] } {
  const active = aggs.filter(a => a.latest.status !== 'withdrawn');
  return {
    confirmed: active.filter(isHandoverReady),
    pending: active.filter(a => !isHandoverReady(a)),
  };
}
