import { create } from 'zustand';
import type { SchemeId, RecordStatus, AnomalyType, ReviewRecord, AnomalyItem, FireZone, TimelineNode } from '../types';
import { FIRE_ZONES, REVIEW_RECORDS, ANOMALY_ITEMS, TIMELINE_NODES } from '../data/mockData';

interface ReviewState {
  zones: FireZone[];
  records: ReviewRecord[];
  anomalies: AnomalyItem[];
  timeline: TimelineNode[];

  activeScheme: SchemeId;
  selectedZoneId: string | null;
  timelineIndex: number;
  statusFilter: RecordStatus | 'all';
  anomalyFilter: AnomalyType | 'all';
  searchKeyword: string;
  guidedStep: number;
  showGuide: boolean;

  setActiveScheme: (s: SchemeId) => void;
  selectZone: (id: string | null) => void;
  setTimelineIndex: (i: number) => void;
  setStatusFilter: (s: RecordStatus | 'all') => void;
  setAnomalyFilter: (a: AnomalyType | 'all') => void;
  setSearchKeyword: (kw: string) => void;

  updateRecordStatus: (recordId: string, status: RecordStatus, conclusion?: string) => void;
  patchRemarks: (recordId: string, patch: Partial<ReviewRecord['remarks']>) => void;
  addAnomaly: (item: Omit<AnomalyItem, 'id' | 'createdAt' | 'resolved'>) => void;
  resolveAnomaly: (anomalyId: string, resolved: boolean) => void;

  setGuidedStep: (s: number) => void;
  setShowGuide: (v: boolean) => void;
  resetDemo: () => void;
}

const STORAGE_KEY = 'fire-zone-review-state-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function persist(state: Partial<ReviewState>) {
  try {
    const pick = (({ records, anomalies, guidedStep, showGuide }) => ({ records, anomalies, guidedStep, showGuide }))(
      state as ReviewState
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pick));
  } catch (_) {}
}

const initial = loadState();

export const useReviewStore = create<ReviewState>((set, get) => ({
  zones: FIRE_ZONES,
  records: initial?.records ?? REVIEW_RECORDS,
  anomalies: initial?.anomalies ?? ANOMALY_ITEMS,
  timeline: TIMELINE_NODES,

  activeScheme: 'A',
  selectedZoneId: null,
  timelineIndex: TIMELINE_NODES.length - 1,
  statusFilter: 'all',
  anomalyFilter: 'all',
  searchKeyword: '',
  guidedStep: initial?.guidedStep ?? 0,
  showGuide: initial?.showGuide ?? true,

  setActiveScheme: (s) => set({ activeScheme: s }),
  selectZone: (id) => set({ selectedZoneId: id }),
  setTimelineIndex: (i) => set({ timelineIndex: i }),
  setStatusFilter: (s) => set({ statusFilter: s }),
  setAnomalyFilter: (a) => set({ anomalyFilter: a }),
  setSearchKeyword: (kw) => set({ searchKeyword: kw }),

  updateRecordStatus: (recordId, status, conclusion) =>
    set((state) => {
      const records = state.records.map((r) =>
        r.id === recordId
          ? { ...r, status, ...(conclusion !== undefined ? { fileConclusion: conclusion } : {}), reviewedAt: new Date().toISOString() }
          : r
      );
      persist({ ...state, records });
      return { records };
    }),

  patchRemarks: (recordId, patch) =>
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id !== recordId) return r;
        const next = { ...r.remarks, ...patch, lastModified: new Date().toISOString() };
        const values = [next.bimOriginal, next.supplementary, next.verbal].filter(Boolean) as string[];
        const normalized = values.map((v) => v.replace(/\s+/g, '').toLowerCase());
        const hasConflict = normalized.length > 0 && !normalized.every((v) => v === normalized[0]);
        next.hasConflict = hasConflict;
        return { ...r, remarks: next };
      });
      persist({ ...state, records });
      return { records };
    }),

  addAnomaly: (item) =>
    set((state) => {
      const anomaly: AnomalyItem = {
        ...item,
        id: `ANOM-${String(state.anomalies.length + 1).padStart(3, '0')}`,
        createdAt: new Date().toISOString(),
        resolved: false
      };
      const anomalies = [...state.anomalies, anomaly];
      const records = state.records.map((r) =>
        r.zoneId === item.zoneId && r.schemeId === item.schemeId
          ? { ...r, anomalyIds: [...r.anomalyIds, anomaly.id] }
          : r
      );
      persist({ ...state, anomalies, records });
      return { anomalies, records };
    }),

  resolveAnomaly: (anomalyId, resolved) =>
    set((state) => {
      const anomalies = state.anomalies.map((a) => (a.id === anomalyId ? { ...a, resolved } : a));
      persist({ ...state, anomalies });
      return { anomalies };
    }),

  setGuidedStep: (s) =>
    set((state) => {
      persist({ ...state, guidedStep: s });
      return { guidedStep: s };
    }),

  setShowGuide: (v) =>
    set((state) => {
      persist({ ...state, showGuide: v });
      return { showGuide: v };
    }),

  resetDemo: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      records: REVIEW_RECORDS,
      anomalies: ANOMALY_ITEMS,
      guidedStep: 0,
      showGuide: true,
      activeScheme: 'A',
      selectedZoneId: null,
      timelineIndex: TIMELINE_NODES.length - 1,
      statusFilter: 'all',
      anomalyFilter: 'all'
    });
  }
}));

export function getFilteredRecords() {
  const { records, activeScheme, statusFilter, searchKeyword, selectedZoneId } = useReviewStore.getState();
  return records.filter((r) => {
    if (r.schemeId !== activeScheme) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (selectedZoneId && r.zoneId !== selectedZoneId) return false;
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      return (
        r.zoneId.toLowerCase().includes(kw) ||
        (r.remarks.bimOriginal ?? '').toLowerCase().includes(kw) ||
        (r.remarks.supplementary ?? '').toLowerCase().includes(kw) ||
        r.fileConclusion.toLowerCase().includes(kw)
      );
    }
    return true;
  });
}

export function getFilteredAnomalies() {
  const { anomalies, activeScheme, anomalyFilter, statusFilter, records } = useReviewStore.getState();
  const statusMap = new Map(records.map((r) => [`${r.zoneId}-${r.schemeId}`, r.status]));
  return anomalies.filter((a) => {
    if (a.schemeId !== activeScheme) return false;
    if (anomalyFilter !== 'all' && a.type !== anomalyFilter) return false;
    if (statusFilter !== 'all') {
      const key = `${a.zoneId}-${a.schemeId}`;
      if (statusMap.get(key) !== statusFilter) return false;
    }
    return true;
  });
}

export function getStatusCounts() {
  const { records, activeScheme } = useReviewStore.getState();
  const filtered = records.filter((r) => r.schemeId === activeScheme);
  return {
    total: filtered.length,
    confirmed: filtered.filter((r) => r.status === 'confirmed').length,
    pending: filtered.filter((r) => r.status === 'pending').length,
    returned: filtered.filter((r) => r.status === 'returned').length
  };
}
