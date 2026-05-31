import type { TimelineRecord, Anomaly, DriftZone } from '@/types';
import { generateId, getTimeOverlap, levenshteinDistance } from './time';

export function detectDuplicates(records: TimelineRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    if (processed.has(records[i].id)) continue;

    const a = records[i];
    const aEnd = a.startTime + a.duration;
    const duplicates: string[] = [];

    for (let j = i + 1; j < records.length; j++) {
      if (processed.has(records[j].id)) continue;
      if (a.type !== records[j].type) continue;

      const b = records[j];
      const bEnd = b.startTime + b.duration;
      const overlap = getTimeOverlap(a.startTime, aEnd, b.startTime, bEnd);
      const distance = levenshteinDistance(a.title, b.title);

      if (overlap > 0.8 || (overlap > 0.5 && distance < 3)) {
        duplicates.push(b.id);
        processed.add(b.id);
      }
    }

    if (duplicates.length > 0) {
      anomalies.push({
        id: generateId(),
        recordId: a.id,
        type: 'duplicate',
        description: `检测到 ${duplicates.length + 1} 条重复记录，时间重叠度超过 80%`,
        resolved: false,
        relatedRecordIds: [a.id, ...duplicates],
      });
      processed.add(a.id);
    }
  }

  return anomalies;
}

export function detectLateArrivals(records: TimelineRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  records.forEach((record) => {
    if (record.meta?.importDelay && record.meta.importDelay > 0) {
      anomalies.push({
        id: generateId(),
        recordId: record.id,
        type: 'late',
        description: `附件晚到 ${record.meta.importDelay} 小时，导入时间晚于预期提交时间`,
        resolved: false,
      });
    }
  });

  return anomalies;
}

export function detectMissingFields(records: TimelineRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  records.forEach((record) => {
    const missing: string[] = [];
    if (!record.title) missing.push('标题');
    if (record.duration <= 0) missing.push('时长');
    if (record.startTime < 0) missing.push('开始时间');

    if (record.type === 'guest' && !record.meta?.speakerName) {
      missing.push('嘉宾姓名');
    }
    if (record.type === 'ad' && !record.meta?.adClient) {
      missing.push('广告客户');
    }

    if (missing.length > 0) {
      anomalies.push({
        id: generateId(),
        recordId: record.id,
        type: 'missing',
        description: `缺失字段: ${missing.join(', ')}`,
        resolved: false,
      });
    }
  });

  return anomalies;
}

export function detectDriftZones(records: TimelineRecord[]): DriftZone[] {
  if (records.length < 3) return [];

  const sorted = [...records].sort((a, b) => a.startTime - b.startTime);
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].startTime - (sorted[i - 1].startTime + sorted[i - 1].duration);
    if (gap > 0) {
      intervals.push(gap);
    }
  }

  if (intervals.length === 0) return [];

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  const driftZones: DriftZone[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].startTime + sorted[i - 1].duration;
    const gap = sorted[i].startTime - prevEnd;

    if (gap > mean + 2 * stdDev) {
      const severity = gap > mean + 3 * stdDev ? 'high' : gap > mean + 2.5 * stdDev ? 'medium' : 'low';
      driftZones.push({
        startTime: prevEnd,
        endTime: sorted[i].startTime,
        severity,
        description: `时间间隔异常: ${gap.toFixed(1)}秒 (均值: ${mean.toFixed(1)}秒, ${severity === 'high' ? '>3σ' : '>2σ'})`,
      });
    }
  }

  return driftZones;
}

export function detectAllAnomalies(records: TimelineRecord[]): Anomaly[] {
  return [
    ...detectDuplicates(records),
    ...detectLateArrivals(records),
    ...detectMissingFields(records),
  ];
}
