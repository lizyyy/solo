import type { ErrorRecord, KnowledgeNode, RecordState } from '@/types';

export function checkDuplicate(
  record: ErrorRecord,
  allRecords: ErrorRecord[],
  excludeId?: string
): { isDuplicate: boolean; reason: string; matchedId?: string } {
  const matched = allRecords.find(
    (r) =>
      r.id !== excludeId &&
      r.studentId === record.studentId &&
      r.questionId === record.questionId &&
      !r.isWithdrawn
  );
  if (matched) {
    return {
      isDuplicate: true,
      reason: `学生 ${record.studentName} 的「${record.questionTitle.slice(0, 15)}...」已有记录（${matched.id}），样本重复`,
      matchedId: matched.id,
    };
  }
  return { isDuplicate: false, reason: '' };
}

export function getAllRecords(records: RecordState): ErrorRecord[] {
  return [...records.processed, ...records.pending, ...records.manual];
}

export function calcNodeErrorCounts(
  nodes: KnowledgeNode[],
  records: RecordState
): KnowledgeNode[] {
  const validRecords = records.processed.filter((r) => !r.isDuplicate);
  const countMap = new Map<string, number>();
  for (const r of validRecords) {
    const current = countMap.get(r.nodeId) ?? 0;
    countMap.set(r.nodeId, current + 1);
  }
  return nodes.map((n) => ({
    ...n,
    errorCount: countMap.get(n.id) ?? 0,
  }));
}

export function verifyCaliber(
  nodes: KnowledgeNode[],
  records: RecordState
): boolean {
  const counts = calcNodeErrorCounts(nodes, records);
  const nodeMap = new Map(counts.map((n) => [n.id, n.errorCount]));
  for (const node of nodes) {
    const expected = nodeMap.get(node.id) ?? 0;
    if (node.errorCount !== expected) return false;
  }
  return true;
}

export function moveRecord(
  records: RecordState,
  recordId: string,
  targetStatus: 'processed' | 'pending' | 'manual'
): RecordState {
  let found: ErrorRecord | null = null;
  const newRecords = { ...records } as any;
  for (const status of ['processed', 'pending', 'manual'] as const) {
    newRecords[status] = records[status].filter((r) => {
      if (r.id === recordId) {
        found = { ...r, status: targetStatus, updatedAt: new Date().toISOString() };
        return false;
      }
      return true;
    });
  }
  if (found) {
    newRecords[targetStatus] = [...newRecords[targetStatus], found];
  }
  return newRecords;
}
