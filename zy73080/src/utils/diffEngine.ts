import type { DiffItem, Snapshot, Remark, MaterialItem, ReviewConclusion } from '@/types';

function diffRemarks(before: Remark[], after: Remark[]): DiffItem[] {
  const items: DiffItem[] = [];
  const afterIds = new Set(after.map((r) => r.id));
  before.forEach((b) => {
    const a = after.find((x) => x.id === b.id);
    if (!a) {
      items.push({
        kind: 'removed',
        section: '备注列表',
        field: b.id,
        before: `[${b.type}] ${b.content.slice(0, 20)}`,
        after: '(已删除)',
        summary: `删除了一条${b.type}备注`,
      });
    } else if (b.content !== a.content || b.type !== a.type) {
      items.push({
        kind: 'changed',
        section: '备注列表',
        field: a.id,
        before: `[${b.type}] ${b.content}`,
        after: `[${a.type}] ${a.content}`,
        summary: `修改了${a.type}备注内容`,
      });
    }
  });
  after.forEach((a) => {
    if (!before.some((b) => b.id === a.id)) {
      items.push({
        kind: 'added',
        section: '备注列表',
        field: a.id,
        before: '(无)',
        after: `[${a.type}] ${a.content.length > 30 ? a.content.slice(0, 30) + '…' : a.content}`,
        summary: `新增了一条${a.type}备注`,
      });
    } else {
      void afterIds;
    }
  });
  return items;
}

function diffMaterials(before: MaterialItem[], after: MaterialItem[]): DiffItem[] {
  const items: DiffItem[] = [];
  after.forEach((a) => {
    const b = before.find((x) => x.id === a.id);
    if (!b) return;
    const beforeDesc = `送审 ${b.submissionSpec} / 施工 ${b.constructionSpec}${b.isMismatch ? ' [不一致]' : ''}`;
    const afterDesc = `送审 ${a.submissionSpec} / 施工 ${a.constructionSpec}${a.isMismatch ? ' [不一致]' : ''}`;
    if (beforeDesc !== afterDesc) {
      items.push({
        kind: 'changed',
        section: '材料送审表',
        field: `${a.id} · ${a.materialName}`,
        before: beforeDesc,
        after: afterDesc,
        summary: `${a.materialName} 口径信息更新`,
      });
    }
  });
  return items;
}

function diffConclusions(before: ReviewConclusion[], after: ReviewConclusion[]): DiffItem[] {
  const items: DiffItem[] = [];
  after.forEach((a) => {
    const b = before.find((x) => x.id === a.id);
    if (!b) {
      items.push({
        kind: 'added',
        section: '复核结论',
        field: a.id,
        before: '(无结论)',
        after: `[${a.status}] ${a.description.slice(0, 50)}…`,
        summary: `新增复核结论：${a.status}`,
      });
      return;
    }
    if (b.status !== a.status) {
      items.push({
        kind: 'changed',
        section: '复核结论',
        field: 'status',
        before: b.status,
        after: a.status,
        summary: `结论状态变化：${b.status} → ${a.status}`,
      });
    }
    if (b.description !== a.description) {
      items.push({
        kind: 'changed',
        section: '复核结论',
        field: 'description',
        before: b.description,
        after: a.description,
        summary: '结论描述更新',
      });
    }
    const setEq = (x: string[], y: string[]) =>
      x.length === y.length && x.every((v) => y.includes(v));
    if (!setEq(b.affectedRemarkIds, a.affectedRemarkIds)) {
      items.push({
        kind: 'changed',
        section: '复核结论 · 影响链',
        field: 'remarks',
        before: `备注 ${b.affectedRemarkIds.length} 条`,
        after: `备注 ${a.affectedRemarkIds.length} 条`,
        summary: `影响链中备注数变化：${b.affectedRemarkIds.length} → ${a.affectedRemarkIds.length}`,
      });
    }
    if (!setEq(b.affectedAnomalyIds, a.affectedAnomalyIds)) {
      items.push({
        kind: 'changed',
        section: '复核结论 · 影响链',
        field: 'anomalies',
        before: `异常 ${b.affectedAnomalyIds.length} 条`,
        after: `异常 ${a.affectedAnomalyIds.length} 条`,
        summary: `影响链中异常项变化`,
      });
    }
  });
  return items;
}

export function computeSnapshotDiff(before: Snapshot, after: Snapshot): DiffItem[] {
  return [
    ...diffMaterials(before.materialItems, after.materialItems),
    ...diffRemarks(before.remarks, after.remarks),
    ...diffConclusions(before.conclusions, after.conclusions),
  ];
}
