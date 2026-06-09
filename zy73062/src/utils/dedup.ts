import type {
  ScheduleVersion, ScheduleAggregate, ScheduleStatus, DiffSpan
} from '../types/schedule';

export function buildBizKey(pipelineNo: string, partModel: string, cycleId: string = 'CYCLE-2026-H1'): string {
  return `${pipelineNo}__${partModel}__${cycleId}`;
}

export function extractBizKeyFromVersion(v: ScheduleVersion): string {
  return buildBizKey(v.pipelineNo, v.partModel);
}

export function dedupAndAggregate(
  versions: ScheduleVersion[]
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

    result.push({
      bizKey,
      latest,
      versions: sorted,
      changeHistory: [],
      evidences: [],
      withdrawnCount,
    });
  }

  return result.sort((a, b) => a.latest.submittedAt.localeCompare(b.latest.submittedAt));
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

export function splitForHandover(aggs: ScheduleAggregate[]): { confirmed: ScheduleAggregate[]; pending: ScheduleAggregate[] } {
  return {
    confirmed: aggs.filter(a => a.latest.status === 'confirmed'),
    pending: aggs.filter(a => a.latest.status === 'pending' || a.latest.status === 'draft'),
  };
}

export function diffAlarmVsRemark(alarm: string, remark: string): DiffSpan[] {
  const alarmWords = alarm.split(/(\s+|[，。、；：！？,.!?;:])/).filter(Boolean);
  const remarkWords = remark.split(/(\s+|[，。、；：！？,.!?;:])/).filter(Boolean);

  const result: DiffSpan[] = [];
  const maxLen = Math.max(alarmWords.length, remarkWords.length);

  for (let i = 0; i < maxLen; i++) {
    const a = alarmWords[i] || '';
    const r = remarkWords[i] || '';
    if (a !== r) {
      if (a) {
        result.push({ text: a, isDiff: true, side: 'alarm' });
      }
    } else {
      if (a) {
        result.push({ text: a, isDiff: false });
      }
    }
  }
  return result;
}
