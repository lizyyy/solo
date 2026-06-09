import type { Batch, ChecklistItem, MatchStatus } from '@/shared/types';

export interface ItemDiff {
  componentId: string;
  field: keyof ChecklistItem | 'status';
  oldValue: string;
  newValue: string;
  changed: boolean;
}

export interface BatchDiffResult {
  oldBatch: Batch;
  newBatch: Batch;
  itemDiffs: Record<string, ItemDiff[]>;
  changedComponents: string[];
  addedComponents: string[];
  removedComponents: string[];
  issueChanges: {
    componentId: string;
    oldCount: number;
    newCount: number;
    oldBlocking: number;
    newBlocking: number;
  }[];
}

export function compareBatches(oldBatch: Batch, newBatch: Batch): BatchDiffResult {
  const oldMap: Record<string, ChecklistItem> = {};
  const newMap: Record<string, ChecklistItem> = {};
  oldBatch.items.forEach((i) => (oldMap[i.componentId] = i));
  newBatch.items.forEach((i) => (newMap[i.componentId] = i));

  const allIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
  const itemDiffs: Record<string, ItemDiff[]> = {};
  const changedComponents: string[] = [];
  const addedComponents: string[] = [];
  const removedComponents: string[] = [];

  const fields: (keyof ChecklistItem)[] = [
    'visaFormId',
    'materialId',
    'constructionStandard',
    'matchStatus',
    'remarks',
  ];

  allIds.forEach((cid) => {
    const old = oldMap[cid];
    const neo = newMap[cid];
    const diffs: ItemDiff[] = [];
    if (!old && neo) {
      addedComponents.push(cid);
      return;
    }
    if (old && !neo) {
      removedComponents.push(cid);
      return;
    }
    fields.forEach((f) => {
      const ov = String(old[f] ?? '');
      const nv = String(neo[f] ?? '');
      diffs.push({
        componentId: cid,
        field: f,
        oldValue: ov,
        newValue: nv,
        changed: ov !== nv,
      });
    });
    const anyChanged = diffs.some((d) => d.changed);
    if (anyChanged) changedComponents.push(cid);
    itemDiffs[cid] = diffs;
  });

  const oldIssuesByComp: Record<string, number[]> = {};
  const newIssuesByComp: Record<string, number[]> = {};
  oldBatch.issues.forEach((i) => {
    const cid = oldBatch.items.find((it) => it.itemId === i.itemId)?.componentId ?? '';
    oldIssuesByComp[cid] = oldIssuesByComp[cid] || [0, 0];
    oldIssuesByComp[cid][0]++;
    if (i.blocksFinalReport) oldIssuesByComp[cid][1]++;
  });
  newBatch.issues.forEach((i) => {
    const cid = newBatch.items.find((it) => it.itemId === i.itemId)?.componentId ?? '';
    newIssuesByComp[cid] = newIssuesByComp[cid] || [0, 0];
    newIssuesByComp[cid][0]++;
    if (i.blocksFinalReport) newIssuesByComp[cid][1]++;
  });

  const issueChanges: BatchDiffResult['issueChanges'] = [];
  const compIds = new Set([...Object.keys(oldIssuesByComp), ...Object.keys(newIssuesByComp)]);
  compIds.forEach((cid) => {
    const [oc = 0, ob = 0] = oldIssuesByComp[cid] || [0, 0];
    const [nc = 0, nb = 0] = newIssuesByComp[cid] || [0, 0];
    if (oc !== nc || ob !== nb) {
      issueChanges.push({
        componentId: cid,
        oldCount: oc,
        newCount: nc,
        oldBlocking: ob,
        newBlocking: nb,
      });
    }
  });

  return {
    oldBatch,
    newBatch,
    itemDiffs,
    changedComponents,
    addedComponents,
    removedComponents,
    issueChanges,
  };
}

export const statusLabel: Record<MatchStatus, string> = {
  matched: '已对齐',
  mismatched: '口径对不上',
  pending: '资料不齐',
};
