import type { GameEvent, GameRecord } from '@/types/gameTypes';

export function traceEventSource(event: GameEvent): string {
  return event.source || '未知来源';
}

export function traceRecordSource(record: GameRecord): string {
  return record.source || '未知来源';
}

export function formatTracePath(record: GameRecord, event?: GameEvent): string {
  const recordSource = traceRecordSource(record);
  if (event) {
    const eventSource = traceEventSource(event);
    return `${recordSource} → ${eventSource}`;
  }
  return recordSource;
}

export function groupAnomaliesBySource(anomalies: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const anomaly of anomalies) {
    const sourceMatch = anomaly.match(/来源：(.+)$/);
    const source = sourceMatch ? sourceMatch[1] : '未知来源';
    const existing = groups.get(source) || [];
    existing.push(anomaly);
    groups.set(source, existing);
  }
  return groups;
}
