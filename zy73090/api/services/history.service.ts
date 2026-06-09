import { getDb } from '../db.js';
import type { LayerHistory } from '../../shared/types.js';

interface HistoryWithLayerName extends LayerHistory {
  layerName: string;
}

type DiffKey = 'status' | 'opinion' | 'note' | 'standardTags' | 'screenshotIds';

interface VersionDiff {
  added: Partial<Record<DiffKey, unknown>>;
  removed: Partial<Record<DiffKey, unknown>>;
  modified: Partial<Record<DiffKey, { from: unknown; to: unknown }>>;
}

function arrayDiff<T>(a: T[], b: T[]): { added: T[]; removed: T[] } {
  const setA = new Set(a.map((x) => JSON.stringify(x)));
  const setB = new Set(b.map((x) => JSON.stringify(x)));
  const added = b.filter((x) => !setA.has(JSON.stringify(x)));
  const removed = a.filter((x) => !setB.has(JSON.stringify(x)));
  return { added, removed };
}

function isArrayEqual<T>(a: T[], b: T[]): boolean {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

export async function getTaskHistory(taskId: string): Promise<HistoryWithLayerName[]> {
  const db = await getDb();
  const layerMap = new Map(db.data.layers.filter((l) => l.taskId === taskId).map((l) => [l.id, l]));
  const layerIds = Array.from(layerMap.keys());

  const histories = db.data.histories
    .filter((h) => layerIds.includes(h.layerId))
    .map((h) => {
      const layer = layerMap.get(h.layerId);
      return {
        ...h,
        layerName: layer?.displayName || layer?.originalName || '未知图层',
      };
    });

  histories.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
  return histories;
}

export async function compareVersions(
  layerId: string,
  v1: number,
  v2: number,
): Promise<VersionDiff | null> {
  const db = await getDb();
  const h1 = db.data.histories.find((h) => h.layerId === layerId && h.version === v1);
  const h2 = db.data.histories.find((h) => h.layerId === layerId && h.version === v2);

  if (!h1 || !h2) return null;

  const diff: VersionDiff = {
    added: {},
    removed: {},
    modified: {},
  };

  const keys: DiffKey[] = ['status', 'opinion', 'note', 'standardTags', 'screenshotIds'];

  for (const key of keys) {
    const val1 = h1[key];
    const val2 = h2[key];

    if (Array.isArray(val1) && Array.isArray(val2)) {
      const { added, removed } = arrayDiff(val1 as string[], val2 as string[]);
      if (added.length > 0) diff.added[key] = added;
      if (removed.length > 0) diff.removed[key] = removed;
      if (!isArrayEqual(val1 as string[], val2 as string[])) {
        diff.modified[key] = { from: val1, to: val2 };
      }
    } else {
      if (val1 === undefined && val2 !== undefined) {
        diff.added[key] = val2;
      } else if (val1 !== undefined && val2 === undefined) {
        diff.removed[key] = val1;
      } else if (val1 !== val2) {
        diff.modified[key] = { from: val1, to: val2 };
      }
    }
  }

  return diff;
}
