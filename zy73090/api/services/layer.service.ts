import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import type { CadLayer, LayerHistory, LayerStatus } from '../../shared/types.js';

interface SubmitReviewPayload {
  status: LayerStatus;
  opinion: string;
  note: string;
  standardTags: string[];
  screenshotIds: string[];
  reviewer: string;
}

interface AppendNotePayload {
  note: string;
  reviewer: string;
  standardTags: string[];
}

function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function computeChangedFields(
  oldLayer: CadLayer,
  oldHistory: LayerHistory | undefined,
  payload: SubmitReviewPayload,
): string[] {
  const changed: string[] = [];
  if (oldLayer.currentStatus !== payload.status) changed.push('status');
  if (oldLayer.latestOpinion !== payload.opinion) changed.push('opinion');
  if (oldHistory && oldHistory.note !== payload.note) changed.push('note');
  if (!deepEqual(oldHistory?.standardTags ?? [], payload.standardTags)) changed.push('standardTags');
  if (!deepEqual(oldHistory?.screenshotIds ?? [], payload.screenshotIds)) changed.push('screenshotIds');
  return changed;
}

export async function getLayersByTask(taskId: string): Promise<CadLayer[]> {
  const db = await getDb();
  const layers = db.data.layers
    .filter((l) => l.taskId === taskId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return layers;
}

export async function getLayer(
  id: string,
): Promise<(CadLayer & { histories: LayerHistory[] }) | null> {
  const db = await getDb();
  const layer = db.data.layers.find((l) => l.id === id);
  if (!layer) return null;

  const histories = db.data.histories
    .filter((h) => h.layerId === id)
    .sort((a, b) => a.version - b.version);

  return { ...layer, histories };
}

export async function submitReview(
  layerId: string,
  payload: SubmitReviewPayload,
): Promise<CadLayer | null> {
  const db = await getDb();
  const layerIdx = db.data.layers.findIndex((l) => l.id === layerId);
  if (layerIdx === -1) return null;

  const layer = db.data.layers[layerIdx];
  const prevHistories = db.data.histories.filter((h) => h.layerId === layerId);
  const lastHistory = prevHistories.sort((a, b) => b.version - a.version)[0];

  const changedFields = computeChangedFields(layer, lastHistory, payload);
  const newVersion = layer.version + 1;

  const newHistory: LayerHistory = {
    id: uuidv4(),
    layerId,
    version: newVersion,
    status: payload.status,
    opinion: payload.opinion,
    note: payload.note,
    reviewer: payload.reviewer,
    reviewedAt: new Date().toISOString(),
    standardTags: payload.standardTags,
    screenshotIds: payload.screenshotIds,
    changedFields,
  };
  db.data.histories.push(newHistory);

  db.data.layers[layerIdx] = {
    ...layer,
    currentStatus: payload.status,
    latestOpinion: payload.opinion,
    version: newVersion,
    updatedAt: new Date().toISOString(),
  };

  if (payload.status !== 'approved') {
    const task = db.data.tasks.find((t) => t.id === layer.taskId);
    if (task && task.status === 'completed') {
      task.status = 'has_legacy';
      task.updatedAt = new Date().toISOString();
    }
  }

  await db.write();
  return db.data.layers[layerIdx];
}

export async function appendNote(
  layerId: string,
  payload: AppendNotePayload,
): Promise<CadLayer | null> {
  const db = await getDb();
  const layerIdx = db.data.layers.findIndex((l) => l.id === layerId);
  if (layerIdx === -1) return null;

  const layer = db.data.layers[layerIdx];
  const prevHistories = db.data.histories.filter((h) => h.layerId === layerId);
  const lastHistory = prevHistories.sort((a, b) => b.version - a.version)[0];

  const newVersion = layer.version + 1;

  const baseHistory: Partial<LayerHistory> = lastHistory
    ? {
        status: lastHistory.status,
        opinion: lastHistory.opinion,
        standardTags: lastHistory.standardTags,
        screenshotIds: lastHistory.screenshotIds,
      }
    : {
        status: layer.currentStatus,
        opinion: layer.latestOpinion,
        standardTags: [],
        screenshotIds: [],
      };

  const newHistory: LayerHistory = {
    id: uuidv4(),
    layerId,
    version: newVersion,
    status: baseHistory.status!,
    opinion: baseHistory.opinion!,
    note: payload.note,
    reviewer: payload.reviewer,
    reviewedAt: new Date().toISOString(),
    standardTags: payload.standardTags,
    screenshotIds: baseHistory.screenshotIds!,
    changedFields: ['note'],
  };
  db.data.histories.push(newHistory);

  db.data.layers[layerIdx] = {
    ...layer,
    version: newVersion,
    updatedAt: new Date().toISOString(),
  };

  await db.write();
  return db.data.layers[layerIdx];
}
