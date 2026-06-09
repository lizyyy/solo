import type { WorkOrder, Statistics } from '../types';

export function calculateStatistics(orders: WorkOrder[]): Statistics {
  const total = orders.length;
  const normal = orders.filter(o => o.judgment === 'normal').length;
  const abnormal = orders.filter(o => o.judgment === 'abnormal').length;
  const pending = orders.filter(o => o.judgment === 'pending_review').length;
  const lateArrivalCount = orders.filter(o =>
    o.photos.some(p => p.isLateArrival) || o.attachments.some(a => a.isLateArrival)
  ).length;
  const oldTerminologyHits = orders.filter(o =>
    o.photos.some(p => p.hitsOldTerminology)
  ).length;
  const duplicateWarnings = orders.filter(o => o.isDuplicateWarning).length;
  return { total, normal, abnormal, pending, lateArrivalCount, oldTerminologyHits, duplicateWarnings };
}
