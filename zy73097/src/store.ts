import { create } from 'zustand';
import { useMemo } from 'react';
import type { MaterialRecord, MaterialStatus, Filters, Stats, SupplementaryNote, HistoryEntry } from './types';
import { MOCK_RECORDS } from './mockData';

const LS_KEY = 'fire-mat-tracker::records::v1';

function loadRecords(): MaterialRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as MaterialRecord[];
  } catch {
    /* ignore */
  }
  return MOCK_RECORDS.map((r) => ({ ...r }));
}

function saveRecords(records: MaterialRecord[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

const STATUS_LABEL_MAP: Record<MaterialStatus, string> = {
  CONFIRMED: '已确认',
  PENDING: '待补件',
  REJECTED: '退回',
};

function isInRange(dateStr: string, from: string | null, to: string | null) {
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export interface MaterialStore {
  records: MaterialRecord[];
  filters: Filters;
  selectedId: string | null;

  // actions
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  selectRecord: (id: string | null) => void;

  updateStatus: (id: string, status: MaterialStatus, reason: string) => void;
  addSupplementaryNote: (id: string, note: Omit<SupplementaryNote, 'id'>) => void;
  markAbnormalityReviewed: (id: string) => void;

  // 调试
  resetAll: () => void;
}

const DEFAULT_FILTERS: Filters = {
  fireZone: null,
  type: null,
  status: null,
  hasAbnormality: null,
  dateFrom: null,
  dateTo: null,
  keyword: '',
};

export const useMaterialStore = create<MaterialStore>((set) => ({
  records: loadRecords(),
  filters: DEFAULT_FILTERS,
  selectedId: null,

  setFilters: (patch) =>
    set((s) => ({
      filters: { ...s.filters, ...patch },
    })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  selectRecord: (id) => set({ selectedId: id }),

  updateStatus: (id, status, reason) => {
    if (!reason.trim()) return;
    set((s) => {
      const records = s.records.map((r) => {
        if (r.id !== id) return r;
        const oldStatus = STATUS_LABEL_MAP[r.status];
        const newStatus = STATUS_LABEL_MAP[status];
        const entry: HistoryEntry = {
          id: Math.random().toString(36).slice(2, 9),
          timestamp: new Date().toISOString(),
          operator: '岑工',
          field: 'status',
          fieldLabel: '审核状态',
          oldValue: oldStatus,
          newValue: newStatus,
          reason: reason.trim(),
        };
        return {
          ...r,
          status,
          history: [entry, ...r.history],
        };
      });
      saveRecords(records);
      return { records };
    });
  },

  addSupplementaryNote: (id, note) => {
    set((s) => {
      const records = s.records.map((r) => {
        if (r.id !== id) return r;
        const newNote: SupplementaryNote = {
          ...note,
          id: Math.random().toString(36).slice(2, 9),
        };
        const entry: HistoryEntry = {
          id: Math.random().toString(36).slice(2, 9),
          timestamp: new Date().toISOString(),
          operator: newNote.handler,
          field: 'note',
          fieldLabel: '后补备注',
          oldValue: '-',
          newValue: `新增：${newNote.content.slice(0, 20)}${newNote.content.length > 20 ? '…' : ''}`,
          reason: '后补备注处理过程记录',
        };
        return {
          ...r,
          supplementaryNotes: [newNote, ...r.supplementaryNotes],
          history: [entry, ...r.history],
        };
      });
      saveRecords(records);
      return { records };
    });
  },

  markAbnormalityReviewed: (id) => {
    set((s) => {
      const records = s.records.map((r) => {
        if (r.id !== id) return r;
        const entry: HistoryEntry = {
          id: Math.random().toString(36).slice(2, 9),
          timestamp: new Date().toISOString(),
          operator: '岑工',
          field: 'layerAbn',
          fieldLabel: '图层异常',
          oldValue: '未复核',
          newValue: '已复核',
          reason: '图层异常原因已确认，按建议提交整改',
        };
        return {
          ...r,
          layerAbnormality: { ...r.layerAbnormality, reviewed: true },
          history: [entry, ...r.history],
        };
      });
      saveRecords(records);
      return { records };
    });
  },

  resetAll: () => {
    localStorage.removeItem(LS_KEY);
    set({ records: MOCK_RECORDS.map((r) => ({ ...r })), filters: DEFAULT_FILTERS, selectedId: null });
  },
}));

// ── 派生函数（独立于组件，保证统一） ────────────────────────────
export function deriveFiltered(records: MaterialRecord[], f: Filters): MaterialRecord[] {
  const kw = f.keyword.trim().toLowerCase();
  return records.filter((r) => {
    if (f.fireZone && r.fireZone !== f.fireZone) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.hasAbnormality !== null && r.layerAbnormality.hasAbnormality !== f.hasAbnormality) return false;
    if (!isInRange(r.submissionDate, f.dateFrom, f.dateTo)) return false;
    if (kw) {
      const blob = `${r.code} ${r.name} ${r.type} ${r.fireZone} ${r.layerName} ${r.submitter}`.toLowerCase();
      if (!blob.includes(kw)) return false;
    }
    return true;
  });
}

export function deriveStats(list: MaterialRecord[]): Stats {
  const s: Stats = { total: list.length, confirmed: 0, pending: 0, rejected: 0, abnormal: 0 };
  for (const r of list) {
    if (r.status === 'CONFIRMED') s.confirmed++;
    if (r.status === 'PENDING') s.pending++;
    if (r.status === 'REJECTED') s.rejected++;
    if (r.layerAbnormality.hasAbnormality && !r.layerAbnormality.reviewed) s.abnormal++;
  }
  return s;
}

// 选择器辅助（React 内 useMemo 保证稳定引用）
export function useFilteredRecords(): MaterialRecord[] {
  const records = useMaterialStore((s) => s.records);
  const filters = useMaterialStore((s) => s.filters);
  return useMemo(() => deriveFiltered(records, filters), [records, filters]);
}

export function useStats(): Stats {
  const list = useFilteredRecords();
  return useMemo(() => deriveStats(list), [list]);
}

export function useSelectedRecord(): MaterialRecord | null {
  const id = useMaterialStore((s) => s.selectedId);
  const records = useMaterialStore((s) => s.records);
  return useMemo(() => records.find((r) => r.id === id) ?? null, [id, records]);
}
