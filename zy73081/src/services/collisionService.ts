import type {
  CollisionRecord,
  CollisionStatus,
  ListFilterParams,
  RejudgePayload,
  SummaryData,
  HistoryRecord,
} from '@/types';
import {
  getAllCollisions,
  upsertCollision,
  initializeStorage,
} from '@/services/storage';

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function computeSummary(list: CollisionRecord[]): SummaryData {
  return {
    total: list.length,
    passed: list.filter((c) => c.status === 'PASSED').length,
    pendingEvidence: list.filter((c) => c.status === 'PENDING_EVIDENCE').length,
    manualRejudged: list.filter((c) => c.status === 'MANUAL_REJUDGED' || c.rejudgeCount > 0).length,
    coordinateOffset: list.filter((c) => c.isCoordinateOffset).length,
  };
}

function applyFilters(list: CollisionRecord[], params?: ListFilterParams) {
  if (!params) return list;
  return list.filter((c) => {
    if (params.status && params.status !== 'ALL' && c.status !== params.status) return false;
    if (params.coordinateOffsetOnly && !c.isCoordinateOffset) return false;
    if (params.project && !c.projectName.includes(params.project)) return false;
    if (params.floor && c.floor !== params.floor) return false;
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      const text = `${c.id} ${c.projectName} ${c.floor} ${c.nodeCode} ${c.collisionType} ${c.elementA} ${c.elementB} ${c.responsiblePerson}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });
}

export const CollisionService = {
  async list(params?: ListFilterParams) {
    await delay(180);
    initializeStorage();
    const all = getAllCollisions();
    const data = applyFilters(all, params);
    return { data, summary: computeSummary(all) };
  },

  async get(id: string) {
    await delay(120);
    initializeStorage();
    const all = getAllCollisions();
    return all.find((c) => c.id === id) || null;
  },

  async rejudge(id: string, payload: RejudgePayload) {
    await delay(300);
    const all = getAllCollisions();
    const idx = all.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error('记录不存在');
    const prev = all[idx];
    const newStatus: CollisionStatus = payload.newStatus === 'MANUAL_REJUDGED' || prev.rejudgeCount > 0
      ? 'MANUAL_REJUDGED'
      : payload.newStatus;
    const histRecord: HistoryRecord = {
      id: `hist-${Date.now()}`,
      collisionId: id,
      previousStatus: prev.status,
      newStatus: payload.newStatus,
      reason: payload.reason,
      operator: payload.operator || '老叶',
      timestamp: new Date().toISOString(),
      evidenceUrls: payload.evidenceUrls || [],
    };
    const updated: CollisionRecord = {
      ...prev,
      status: newStatus,
      rejudgeCount: prev.rejudgeCount + 1,
      history: [...prev.history, histRecord],
      updatedAt: new Date().toISOString(),
    };
    const next = upsertCollision(updated);
    return next.find((c) => c.id === id)!;
  },

  async toggleSample(id: string, isSample: boolean) {
    await delay(150);
    const all = getAllCollisions();
    const idx = all.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error('记录不存在');
    const updated: CollisionRecord = { ...all[idx], isSample, updatedAt: new Date().toISOString() };
    const next = upsertCollision(updated);
    return next.find((c) => c.id === id)!;
  },

  async getHistory(id: string) {
    await delay(120);
    const all = getAllCollisions();
    const rec = all.find((c) => c.id === id);
    return rec ? [...rec.history].reverse() : [];
  },

  projects() {
    const all = getAllCollisions();
    return Array.from(new Set(all.map((c) => c.projectName)));
  },

  floors() {
    const all = getAllCollisions();
    return Array.from(new Set(all.map((c) => c.floor))).sort();
  },
};
