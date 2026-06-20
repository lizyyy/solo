import { create } from 'zustand';
import type {
  PetEvent,
  PetProfile,
  DerivedPet,
  TrainingJudge,
  ExportDiff,
  ExportSummary,
} from '@/types';
import {
  computeDiffsBetween,
  profileToRowValue,
  EXPORT_FIELDS,
  formatDate,
} from '@/utils/tracking';

const OPERATOR = '老周（寄养店店长）';

interface LastExportState {
  snapshot: DerivedPet[];
  exportedAt: number;
  generatedAt: number;
  eventIds: string[];
}

interface ApiResult<T = any> {
  ok: boolean;
  error?: string;
  event?: any;
  exportImpact?: { changedFields: ExportDiff[] };
  pets?: DerivedPet[];
  events?: PetEvent[];
  petId?: string;
  export?: any;
}

async function apiCall<T = any>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'network_error' }));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `API ${path} failed`);
  }
  return data;
}

interface PetStore {
  loading: boolean;
  pets: DerivedPet[];
  events: PetEvent[];
  timeline: PetEvent[];
  timelineLoading: boolean;
  lastExport: LastExportState | null;
  filters: { anomaly?: string; q?: string };

  loadPets: (filters?: { anomaly?: string; q?: string }) => Promise<void>;
  loadTimeline: (petId: string) => Promise<PetEvent[]>;
  resetToDemo: () => Promise<void>;
  clearAll: () => Promise<void>;

  importPet: (profile: PetProfile, source: string, photoUrls: string[], note?: string) => Promise<string>;
  confirmPet: (petId: string, note?: string) => Promise<void>;
  revokePet: (petId: string, reason: string) => Promise<void>;
  addNote: (petId: string, note: string, trainingUpdates?: Partial<PetProfile>) => Promise<ApiResult>;
  rejudgePet: (
    petId: string,
    oldJudge: TrainingJudge,
    newJudge: TrainingJudge,
    reason: string,
    additionalUpdates?: Partial<PetProfile>,
  ) => Promise<void>;

  computeExportDiffSinceLast: () => ExportDiff[];
  buildExportSummary: () => ExportSummary;
  markExported: () => void;
  exportCSVBlob: () => Promise<Blob>;
  exportJSONBlob: () => Promise<Blob>;

  getEventsOfPet: (petId: string) => PetEvent[];
  getPetById: (petId: string) => DerivedPet | undefined;

  _eventCache: Map<string, PetEvent[]>;
}

export const usePetStore = create<PetStore>((set, get) => ({
  loading: false,
  pets: [],
  events: [],
  timeline: [],
  timelineLoading: false,
  lastExport: null,
  filters: {},
  _eventCache: new Map(),

  loadPets: async (filters) => {
    set({ loading: true, filters: filters || {} });
    try {
      const params = new URLSearchParams();
      if (filters?.anomaly) params.set('anomaly', filters.anomaly);
      if (filters?.q) params.set('q', filters.q);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiCall(`/pets${qs}`);
      set({ pets: data.pets || [], loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  loadTimeline: async (petId) => {
    set({ timelineLoading: true });
    try {
      const data = await apiCall(`/pets/${petId}/timeline`);
      const events = (data.events || []).sort((a: PetEvent, b: PetEvent) => b.timestamp - a.timestamp);
      get()._eventCache.set(petId, events);
      set({ timeline: events, timelineLoading: false });
      return events;
    } catch (e) {
      set({ timelineLoading: false });
      throw e;
    }
  },

  resetToDemo: async () => {
    await apiCall('/reset-demo', { method: 'POST' });
    await get().loadPets(get().filters);
    get()._eventCache.clear();
  },

  clearAll: async () => {
    set({ pets: [], lastExport: null });
    get()._eventCache.clear();
  },

  importPet: async (profile, source, photoUrls, note) => {
    const data = await apiCall('/import', {
      method: 'POST',
      body: JSON.stringify({
        profile: { ...profile, photoUrls },
        operator: OPERATOR,
        source,
        note,
      }),
    });
    await get().loadPets(get().filters);
    return data.petId!;
  },

  confirmPet: async (petId, note) => {
    await apiCall(`/pets/${petId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ operator: OPERATOR, note }),
    });
    await get().loadPets(get().filters);
    get()._eventCache.delete(petId);
  },

  revokePet: async (petId, reason) => {
    await apiCall(`/pets/${petId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ operator: OPERATOR, note: reason }),
    });
    await get().loadPets(get().filters);
    get()._eventCache.delete(petId);
  },

  addNote: async (petId, note, trainingUpdates) => {
    const beforePets = get().pets;
    const updates = trainingUpdates || {};
    if (note && (!updates.latestNote || updates.latestNote !== note)) {
      const pet = get().getPetById(petId);
      const existingNote = pet?.latestNote || '';
      updates.latestNote = existingNote ? `${existingNote}；${note}` : note;
    }
    const data = await apiCall(`/pets/${petId}/addendum`, {
      method: 'POST',
      body: JSON.stringify({ operator: OPERATOR, note, updates }),
    });
    await get().loadPets(get().filters);
    get()._eventCache.delete(petId);
    return data;
  },

  rejudgePet: async (petId, oldJudge, newJudge, reason, additionalUpdates) => {
    const updates = additionalUpdates || {};
    await apiCall(`/pets/${petId}/rejudge`, {
      method: 'POST',
      body: JSON.stringify({
        operator: OPERATOR,
        newJudge,
        reason,
        note: `人工改判：${oldJudge} → ${newJudge}`,
        ...updates,
      }),
    });
    await get().loadPets(get().filters);
    get()._eventCache.delete(petId);
  },

  computeExportDiffSinceLast: () => {
    const state = get();
    if (!state.lastExport) {
      return computeDiffsBetween([], state.pets, []);
    }
    return computeDiffsBetween(state.lastExport.snapshot, state.pets, []);
  },

  buildExportSummary: () => {
    const state = get();
    return {
      totalRows: state.pets.length,
      anomalyRows: state.pets.filter((p) => p.anomalies.length > 0).length,
      diffs: state.computeExportDiffSinceLast(),
      generatedAt: Date.now(),
    };
  },

  markExported: () => {
    const state = get();
    const now = Date.now();
    set({
      lastExport: {
        snapshot: state.pets.map((p) => ({ ...p, aliases: [...p.aliases], photoUrls: [...p.photoUrls], anomalies: p.anomalies.map((a) => ({ ...a })) })),
        exportedAt: now,
        generatedAt: now,
        eventIds: [],
      },
    });
  },

  exportCSVBlob: async () => {
    const params = new URLSearchParams();
    if (get().filters.anomaly) params.set('anomaly', get().filters.anomaly);
    if (get().filters.q) params.set('q', get().filters.q);
    params.set('format', 'csv');
    const res = await fetch(`/api/export?${params.toString()}`);
    const text = await res.text();
    const summary = get().buildExportSummary();
    let notes = '\n\n';
    notes += '# ====== 导出变更说明 ======\n';
    notes += `# 生成时间：${formatDate(summary.generatedAt)}\n`;
    notes += `# 总行数：${summary.totalRows}，异常行数：${summary.anomalyRows}\n`;
    if (summary.diffs.length) {
      notes += `# 与上次导出相比共 ${summary.diffs.length} 处变更：\n`;
      summary.diffs.forEach((d, i) => {
        const row = d.rowIndex > 0 ? `第${d.rowIndex}行` : '删除行';
        notes += `#   ${i + 1}. ${row}·${d.field}：${d.oldValue} → ${d.newValue}（${d.reason || d.eventType}）\n`;
      });
    } else {
      notes += '# 无差异（本次为首次导出或内容未变化）\n';
    }
    get().markExported();
    return new Blob(['\uFEFF' + text + notes], { type: 'text/csv;charset=utf-8' });
  },

  exportJSONBlob: async () => {
    const params = new URLSearchParams();
    if (get().filters.anomaly) params.set('anomaly', get().filters.anomaly);
    if (get().filters.q) params.set('q', get().filters.q);
    const data = await apiCall(`/export?${params.toString()}`);
    const exportData = data.export;
    const summary = get().buildExportSummary();
    const payload = {
      exportedAt: formatDate(summary.generatedAt),
      summary: {
        totalRows: summary.totalRows,
        anomalyRows: summary.anomalyRows,
        diffCount: summary.diffs.length,
      },
      changesSinceLast: summary.diffs,
      exportId: exportData.id,
      checksum: exportData.checksum,
      rows: exportData.rows,
      pets: get().pets.map((p) => ({
        petId: p.petId,
        name: p.name,
        aliases: p.aliases,
        species: p.species,
        breed: p.breed,
        vaccineStatus: p.vaccineStatus,
        trainingProgress: p.trainingProgress,
        trainingJudge: p.trainingJudge,
        latestNote: p.latestNote,
        photoUrls: p.photoUrls,
        confirmed: p.confirmed,
        revoked: p.revoked,
        anomalies: p.anomalies,
        lastModifiedAt: formatDate(p.lastModifiedAt),
        eventCount: p.eventCount,
      })),
    };
    get().markExported();
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  },

  getEventsOfPet: (petId) => get()._eventCache.get(petId) || [],

  getPetById: (petId) => get().pets.find((p) => p.petId === petId),
}));
