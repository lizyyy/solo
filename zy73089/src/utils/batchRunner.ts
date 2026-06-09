import type { Batch, HistoryEvent } from '@/shared/types';

export function generateBatchId(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const prefix = `B${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const suffix = Math.floor(Math.random() * 900 + 100).toString();
  return `${prefix}-${suffix}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function buildRerunBatch(original: Batch, newRemark: string): { batch: Batch; event: HistoryEvent } {
  const newId = generateBatchId();
  const now = isoNow();
  const appendedRemark = original.remark
    ? `${original.remark}\n【补备注 ${now}】${newRemark}`
    : `【初始备注】${newRemark}`;

  const newItems = original.items.map((it) => ({
    ...it,
    itemId: `${newId}__${it.componentId}`,
    batchId: newId,
    remarks: it.remarks ? `${it.remarks}\n${newRemark}` : newRemark,
  }));

  const issueIdMap: Record<string, string> = {};
  const newIssues = original.issues.map((iss) => {
    const nid = `issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    issueIdMap[iss.issueId] = nid;
    return {
      ...iss,
      issueId: nid,
      itemId: `${newId}__${original.items.find((i) => i.itemId === iss.itemId)?.componentId ?? ''}`,
    };
  });

  const batch: Batch = {
    batchId: newId,
    parentBatchId: original.batchId,
    name: `${original.name}（补备注重跑）`,
    status: original.status,
    runType: 'rerun',
    createdAt: now,
    remark: appendedRemark,
    items: newItems,
    issues: newIssues,
  };

  const event: HistoryEvent = {
    eventId: `evt-${Date.now()}`,
    batchId: newId,
    timestamp: now,
    eventType: 'batch_rerun',
    description: `基于批次 ${original.batchId} 补备注重跑，生成新批次 ${newId}`,
  };

  return { batch, event };
}
