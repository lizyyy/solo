import type { InspectionRecord, Remark, StoreStatus } from '../types';

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function generateDedupKey(deviceId: string, inspectionTime: number): string {
  const minuteFloor = Math.floor(inspectionTime / 60000);
  return `${deviceId}|${minuteFloor}`;
}

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTimeShort(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getMetricStatus(
  value: number,
  threshold: number,
  warningRatio = 0.8
): StoreStatus {
  if (value >= threshold) return 'anomaly';
  if (value >= threshold * warningRatio) return 'warning';
  return 'normal';
}

export function statusLabel(s: StoreStatus): string {
  const map: Record<StoreStatus, string> = {
    normal: '正常',
    warning: '预警',
    anomaly: '异常',
  };
  return map[s];
}

export function statusColor(s: StoreStatus): string {
  const map: Record<StoreStatus, string> = {
    normal: 'bg-emerald-500',
    warning: 'bg-amber-500',
    anomaly: 'bg-red-500',
  };
  return map[s];
}

export function statusTextColor(s: StoreStatus): string {
  const map: Record<StoreStatus, string> = {
    normal: 'text-emerald-400',
    warning: 'text-amber-400',
    anomaly: 'text-red-400',
  };
  return map[s];
}

export function statusBorderColor(s: StoreStatus): string {
  const map: Record<StoreStatus, string> = {
    normal: 'border-emerald-500/40',
    warning: 'border-amber-500/40',
    anomaly: 'border-red-500/40',
  };
  return map[s];
}

export interface DedupResult {
  inserted: InspectionRecord[];
  updated: InspectionRecord[];
  duplicateCount: number;
  preservedRemarkCount: number;
  existingRemarksMap: Map<string, Remark[]>;
}

export function dedupInspectionRecords(
  incoming: InspectionRecord[],
  existing: InspectionRecord[],
  existingRemarks: Remark[]
): DedupResult {
  const existingMap = new Map<string, InspectionRecord>();
  existing.forEach((r) => {
    existingMap.set(generateDedupKey(r.deviceId, r.inspectionTime), r);
  });

  const remarksByInspection = new Map<string, Remark[]>();
  existingRemarks.forEach((r) => {
    const arr = remarksByInspection.get(r.inspectionId) || [];
    arr.push(r);
    remarksByInspection.set(r.inspectionId, arr);
  });

  const inserted: InspectionRecord[] = [];
  const updated: InspectionRecord[] = [];
  let duplicateCount = 0;
  let preservedRemarkCount = 0;

  incoming.forEach((rec) => {
    const key = generateDedupKey(rec.deviceId, rec.inspectionTime);
    const oldRec = existingMap.get(key);
    if (oldRec) {
      duplicateCount++;
      const oldRemarks = remarksByInspection.get(oldRec.id) || [];
      if (oldRemarks.length > 0) {
        preservedRemarkCount += oldRemarks.length;
      }
      const merged: InspectionRecord = {
        ...rec,
        id: oldRec.id,
        sourceImportId: oldRec.sourceImportId,
        createdAt: oldRec.createdAt,
        updatedAt: Date.now(),
      };
      updated.push(merged);
    } else {
      inserted.push({
        ...rec,
        id: rec.id || generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  });

  return { inserted, updated, duplicateCount, preservedRemarkCount, existingRemarksMap: remarksByInspection };
}

export function metricLabel(m: string): string {
  const map: Record<string, string> = {
    temperature: '温度',
    vibration: '振动',
    wear: '磨损',
    overall: '综合',
    rotationSpeed: '转速',
    cutterWear: '刀具磨损',
  };
  return map[m] || m;
}

export function metricUnit(m: string): string {
  const map: Record<string, string> = {
    temperature: '℃',
    vibration: 'mm/s',
    wear: 'mm',
    rotationSpeed: 'rpm',
    cutterWear: 'mm',
  };
  return map[m] || '';
}

export async function sha256(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
