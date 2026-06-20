import { store } from '../data/store.js';
import type {
  ScheduleListFilters,
  ScheduleItem,
  Snapshot,
  ScheduleBatch,
  MaintenancePhoto,
  OverrideRecord,
} from '../../shared/types.js';

const PART_PRICES: Record<string, number> = {
  'T-YK-003': 230,
  'T-YK-003-B': 325,
  'T-MJ-012': 88,
  'T-MJ-012L': 102,
  'T-PZ-207': 410,
  'T-PZ-207N': 485,
  'T-ZD-088': 180,
  'T-DL-041': 65,
  'T-AM-055': 360,
  'T-KG-093': 55,
};

function partPrice(code: string): number {
  return PART_PRICES[code] ?? 100;
}

export interface FilterResult {
  batches: ScheduleBatch[];
  items: ScheduleItem[];
  matchedBatchIds: string[];
  matchedItemIds: string[];
}

function normalizeDateTo(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s + ' 23:59';
  }
  return s;
}

export function applyFilters(filters: ScheduleListFilters): FilterResult {
  const dateTo = filters.dateTo ? normalizeDateTo(filters.dateTo) : undefined;

  let matchedBatches = [...store.batches];

  if (filters.dateFrom) {
    matchedBatches = matchedBatches.filter((b) => b.createdAt >= filters.dateFrom!);
  }
  if (dateTo) {
    matchedBatches = matchedBatches.filter((b) => b.createdAt <= dateTo);
  }
  if (filters.batchIds && filters.batchIds.length > 0) {
    matchedBatches = matchedBatches.filter((b) => filters.batchIds!.includes(b.batchId));
  }
  if (filters.statuses && filters.statuses.length > 0) {
    matchedBatches = matchedBatches.filter((b) => filters.statuses!.includes(b.status));
  }
  if (filters.isOverridden !== undefined) {
    matchedBatches = matchedBatches.filter((b) =>
      filters.isOverridden ? b.overrideCount > 0 : b.overrideCount === 0,
    );
  }

  const itemLevelBatchIds = new Set<string>();
  if ((filters.elevatorNos && filters.elevatorNos.length > 0) || (filters.partNos && filters.partNos.length > 0)) {
    for (const item of store.items) {
      let hit = true;
      if (filters.elevatorNos && filters.elevatorNos.length > 0) {
        hit = hit && filters.elevatorNos.includes(item.elevatorNo);
      }
      if (hit && filters.partNos && filters.partNos.length > 0) {
        hit = filters.partNos.includes(item.recommendedPartNo) || filters.partNos.includes(item.finalPartNo);
      }
      if (hit) itemLevelBatchIds.add(item.batchId);
    }
    matchedBatches = matchedBatches.filter((b) => itemLevelBatchIds.has(b.batchId));
  }

  const matchedBatchIds = matchedBatches.map((b) => b.batchId);
  const batchIdSet = new Set(matchedBatchIds);

  let matchedItems = store.items.filter((it) => batchIdSet.has(it.batchId));

  if (filters.elevatorNos && filters.elevatorNos.length > 0) {
    matchedItems = matchedItems.filter((it) => filters.elevatorNos!.includes(it.elevatorNo));
  }
  if (filters.partNos && filters.partNos.length > 0) {
    matchedItems = matchedItems.filter(
      (it) =>
        filters.partNos!.includes(it.recommendedPartNo) || filters.partNos!.includes(it.finalPartNo),
    );
  }
  if (filters.isOverridden !== undefined) {
    matchedItems = matchedItems.filter((it) => it.isOverridden === filters.isOverridden);
  }

  const matchedItemIds = matchedItems.map((it) => it.id);

  return {
    batches: matchedBatches,
    items: matchedItems,
    matchedBatchIds,
    matchedItemIds,
  };
}

export function getFilteredBatches(filters: ScheduleListFilters): ScheduleBatch[] {
  return applyFilters(filters).batches;
}

export function getItems(filters: ScheduleListFilters): ScheduleItem[] {
  return applyFilters(filters).items;
}

export interface BatchDetail {
  batch: ScheduleBatch;
  items: ScheduleItem[];
  photos: MaintenancePhoto[];
  overrides: OverrideRecord[];
}

export function getBatchDetail(batchId: string): BatchDetail | null {
  const batch = store.batches.find((b) => b.batchId === batchId);
  if (!batch) return null;

  const items = store.items.filter((it) => it.batchId === batchId);
  const photos = store.photos.filter((p) => p.batchId === batchId);
  const overrides = store.overrides.filter((o) => o.batchId === batchId);

  return { batch, items, photos, overrides };
}

export function rerunBatch(
  batchId: string,
  payload: { supplementaryPhotos: Array<{ itemId: string; url: string; uploadedBy: string; supplementaryNote?: string }> },
): BatchDetail | null {
  const originalBatch = store.batches.find((b) => b.batchId === batchId);
  if (!originalBatch) return null;

  const newVersion = originalBatch.version + 1;
  const newBatchId = `${originalBatch.batchId}-V${newVersion}`;
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const originalItems = store.items.filter((it) => it.batchId === batchId);
  const originalPhotos = store.photos.filter((p) => p.batchId === batchId);

  const newBatch: ScheduleBatch = {
    ...originalBatch,
    batchId: newBatchId,
    version: newVersion,
    status: 'rerun',
    parentBatchId: originalBatch.batchId,
    createdAt: now,
    overrideCount: 0,
    itemCount: originalItems.length + 1,
  };

  const copiedItems: ScheduleItem[] = originalItems.map((it, idx) => ({
    ...it,
    id: `${it.id}-V${newVersion}`,
    batchId: newBatchId,
    version: newVersion,
    photoIds: it.photoIds.map((pid) => `${pid}-V${newVersion}-${idx}`),
    isOverridden: false,
    overrideId: undefined,
  }));

  const newItemId = `i-rerun-${Date.now()}`;
  const supplementaryItem: ScheduleItem = {
    id: newItemId,
    batchId: newBatchId,
    version: newVersion,
    elevatorNo: 'E-C-12',
    faultCode: 'F307',
    faultDescription: '制动闸瓦磨损（补录照片后追加）',
    recommendedPartNo: 'T-ZD-088',
    recommendedPartName: '制动闸瓦',
    recommendedQty: 1,
    finalPartNo: 'T-ZD-088',
    finalPartName: '制动闸瓦',
    finalQty: 1,
    isOverridden: false,
    photoIds: payload.supplementaryPhotos.map((_, i) => `p-supp-${newItemId}-${i}`),
    lateNote: `补录照片后追加，重跑版本 V${newVersion}`,
    monthlyImpactBefore: partPrice('T-ZD-088') * 1,
    monthlyImpactAfter: partPrice('T-ZD-088') * 1,
  };

  const newItems: ScheduleItem[] = [...copiedItems, supplementaryItem];

  const copiedPhotos: MaintenancePhoto[] = originalPhotos.map((p, idx) => ({
    ...p,
    id: `${p.id}-V${newVersion}-${idx}`,
    batchId: newBatchId,
    itemId:
      copiedItems.find((ci) => ci.photoIds.includes(`${p.id}-V${newVersion}-${idx}`))?.id ??
      p.itemId,
    uploadedAt: now,
  }));

  const supplementaryPhotos: MaintenancePhoto[] = payload.supplementaryPhotos.map((sp, i) => ({
    id: supplementaryItem.photoIds[i],
    itemId: newItemId,
    batchId: newBatchId,
    url: sp.url,
    uploadedAt: now,
    uploadedBy: sp.uploadedBy,
    supplementaryNote: sp.supplementaryNote,
    isSupplementary: true,
  }));

  const newPhotos: MaintenancePhoto[] = [...copiedPhotos, ...supplementaryPhotos];

  const prevSnapshot = store.snapshots
    .filter((s) => s.batchId === originalBatch.batchId)
    .sort((a, b) => b.version - a.version)[0];

  const missingIdsFromPrev = prevSnapshot?.continuityCheck.missingItemIds ?? [];
  const hasGap = missingIdsFromPrev.length > 0 && missingIdsFromPrev[0] !== newItemId ? false : false;
  const gapDetails =
    missingIdsFromPrev.length > 0
      ? `补录新增缺失行 ${supplementaryItem.id}（T-ZD-088 制动闸瓦），V${originalBatch.version} 断档已修复`
      : undefined;

  const newSnapshot: Snapshot = {
    id: `snap-${newBatchId}-V${newVersion}`,
    batchId: newBatchId,
    version: newVersion,
    createdAt: now,
    trigger: 'rerun',
    itemSnapshot: newItems.map((it) => ({ ...it })),
    continuityCheck: {
      hasGap,
      gapDetails,
      missingItemIds: [],
    },
  };

  store.batches.push(newBatch);
  store.items.push(...newItems);
  store.photos.push(...newPhotos);
  store.snapshots.push(newSnapshot);

  return {
    batch: newBatch,
    items: newItems,
    photos: newPhotos,
    overrides: [],
  };
}

export function getSnapshots(batchId: string): Snapshot[] {
  const batch = store.batches.find((b) => b.batchId === batchId);
  if (!batch) return [];

  const batchIds: string[] = [batchId];
  if (batch.parentBatchId) {
    batchIds.push(batch.parentBatchId);
  }

  const chainSnapshots = store.snapshots.filter((s) => batchIds.includes(s.batchId));

  return chainSnapshots.sort((a, b) => a.version - b.version);
}
