import { create } from 'zustand';
import type {
  TempControlRecord,
  FilterState,
  DrillDownState,
  MergeGroup,
  AnomalyQueueItem,
  JudgmentRecord,
  SupplementaryNote,
  RecordStatus,
  PetCategory,
} from '@/types';
import { MOCK_RECORDS, PRESET_MERGE_GROUPS, CURRENT_OPERATOR } from '@/data/mockRecords';

export interface PersistSlice {
  confirmedIds: string[];
  anomalyQueue: AnomalyQueueItem[];
  mergeGroups: MergeGroup[];
  judgmentsMap: Record<string, JudgmentRecord[]>;
  supplementaryMap: Record<string, SupplementaryNote[]>;
  statusOverrides: Record<string, RecordStatus>;
  lastSavedAt: string;
  lastOperator: string;
  lastAction: string;
  filterStatePersist: Partial<FilterState>;
}

export interface UIState {
  openDetailId: string | null;
  showMergeModal: boolean;
  showExportPanel: boolean;
  showGuide: boolean;
  queueWidth: number;
  hydrateReady: boolean;
}

export interface AppState extends PersistSlice {
  records: TempControlRecord[];
  filterState: FilterState;
  drillDown: DrillDownState;
  ui: UIState;
}

export interface AppActions {
  getRecordById: (id: string) => TempControlRecord | undefined;
  setFilter: (patch: Partial<FilterState>) => void;
  setDrillDown: (patch: Partial<DrillDownState>) => void;
  toggleConfirm: (recordId: string, confirmed?: boolean) => void;
  addJudgment: (
    recordId: string,
    judgment: Omit<JudgmentRecord, 'id' | 'timestamp' | 'operator'>
  ) => void;
  addSupplementaryNote: (
    recordId: string,
    note: Omit<SupplementaryNote, 'id' | 'timestamp' | 'author'>
  ) => void;
  confirmMergeGroup: (groupId: string) => void;
  applyMerge: (groupId: string) => void;
  setOpenDetail: (id: string | null) => void;
  setShowMergeModal: (show: boolean) => void;
  setShowExportPanel: (show: boolean) => void;
  toggleGuide: () => void;
  setQueueWidth: (width: number) => void;
  saveLastAction: (action: string) => void;
  resetAll: () => void;
}

export type AppStore = AppState & AppActions;

const PERSIST_KEY = 'yichong_temp_persist_v1';

const DEFAULT_FILTER: FilterState = {
  category: 'all',
  status: 'all',
  anomaly: 'all',
  weightAbnormal: 'all',
  hasDuplicate: 'all',
  search: '',
};

const DEFAULT_DRILLDOWN: DrillDownState = {
  type: null,
  recordIds: [],
  openedRecordId: null,
  highlightAt: 0,
};

const DEFAULT_UI: UIState = {
  openDetailId: null,
  showMergeModal: false,
  showExportPanel: false,
  showGuide: true,
  queueWidth: 320,
  hydrateReady: false,
};

const CATEGORY_LABELS: Record<PetCategory, string> = {
  reptile: '爬行类',
  bird: '鸟类',
  smallMammal: '小型哺乳',
  other: '其他',
};
void CATEGORY_LABELS;

function buildAnomalyQueue(records: TempControlRecord[]): AnomalyQueueItem[] {
  const queue: AnomalyQueueItem[] = [];
  const now = new Date().toISOString();
  for (const r of records) {
    if (r.anomalyType && r.anomalyType.length > 0) {
      queue.push({
        recordId: r.id,
        anomalyTypes: [...r.anomalyType],
        resolved: r.status === 'confirmed',
        addedAt: r.measureTime || now,
      });
    }
  }
  return queue;
}

function mergeRecordsWithPatch(
  mockRecords: TempControlRecord[],
  patch: Partial<PersistSlice>,
  presetMergeGroups: MergeGroup[]
): TempControlRecord[] {
  const {
    confirmedIds = [],
    judgmentsMap = {},
    supplementaryMap = {},
    statusOverrides = {},
    mergeGroups = [],
  } = patch;

  const allGroups: MergeGroup[] = [...presetMergeGroups];
  for (const g of mergeGroups) {
    if (!allGroups.find((x) => x.id === g.id)) allGroups.push(g);
  }
  const mergeGroupMap = new Map<string, MergeGroup>();
  for (const mg of allGroups) mergeGroupMap.set(mg.id, mg);

  return mockRecords.map((r) => {
    const record: TempControlRecord = { ...r };

    const merged = mergeGroupMap.get(record.mergeGroupId || '');
    if (merged) {
      record.mergeGroupId = merged.id;
      if (merged.primaryName === record.petName) {
        const set = new Set(record.aliases || []);
        for (const a of merged.aliases) set.add(a);
        record.aliases = Array.from(set);
      }
    }

    if (statusOverrides[record.id]) {
      record.status = statusOverrides[record.id];
    }

    if (confirmedIds.includes(record.id) && record.status !== 'confirmed') {
      record.status = 'confirmed';
      if (!record.confirmedBy) record.confirmedBy = CURRENT_OPERATOR;
      if (!record.confirmedAt) record.confirmedAt = new Date().toISOString();
    }

    if (judgmentsMap[record.id]) {
      record.judgments = [...(record.judgments || []), ...judgmentsMap[record.id]];
    }

    if (supplementaryMap[record.id]) {
      record.supplementaryNotes = [
        ...(record.supplementaryNotes || []),
        ...supplementaryMap[record.id],
      ];
    }

    return record;
  });
}

function ensureQueue(
  queue: AnomalyQueueItem[],
  records: TempControlRecord[]
): AnomalyQueueItem[] {
  if (!queue || queue.length === 0) return buildAnomalyQueue(records);
  const map = new Map(queue.map((q) => [q.recordId, q]));
  for (const r of records) {
    if (r.anomalyType && r.anomalyType.length > 0 && !map.has(r.id)) {
      map.set(r.id, {
        recordId: r.id,
        anomalyTypes: [...r.anomalyType],
        resolved: r.status === 'confirmed',
        addedAt: r.measureTime || new Date().toISOString(),
      });
    }
  }
  return Array.from(map.values());
}

function ensureMergeGroups(
  persisted: MergeGroup[],
  preset: MergeGroup[]
): MergeGroup[] {
  if (!persisted || persisted.length === 0) return preset.map((p) => ({ ...p }));
  const ids = new Set(persisted.map((g) => g.id));
  const out: MergeGroup[] = persisted.map((g) => ({ ...g }));
  for (const p of preset) {
    if (!ids.has(p.id)) out.push({ ...p });
  }
  return out;
}

function buildInitialPersist(): PersistSlice {
  return {
    confirmedIds: [],
    anomalyQueue: [],
    mergeGroups: [],
    judgmentsMap: {},
    supplementaryMap: {},
    statusOverrides: {},
    lastSavedAt: '',
    lastOperator: CURRENT_OPERATOR,
    lastAction: '',
    filterStatePersist: {},
  };
}

function loadPersistFromStorage(): PersistSlice {
  try {
    if (typeof localStorage === 'undefined') return buildInitialPersist();
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return buildInitialPersist();
    const parsed = JSON.parse(raw);
    const init = buildInitialPersist();
    return {
      confirmedIds: Array.isArray(parsed.confirmedIds) ? parsed.confirmedIds : init.confirmedIds,
      anomalyQueue: Array.isArray(parsed.anomalyQueue) ? parsed.anomalyQueue : init.anomalyQueue,
      mergeGroups: Array.isArray(parsed.mergeGroups) ? parsed.mergeGroups : init.mergeGroups,
      judgmentsMap: parsed.judgmentsMap && typeof parsed.judgmentsMap === 'object' ? parsed.judgmentsMap : init.judgmentsMap,
      supplementaryMap: parsed.supplementaryMap && typeof parsed.supplementaryMap === 'object' ? parsed.supplementaryMap : init.supplementaryMap,
      statusOverrides: parsed.statusOverrides && typeof parsed.statusOverrides === 'object' ? parsed.statusOverrides : init.statusOverrides,
      lastSavedAt: typeof parsed.lastSavedAt === 'string' ? parsed.lastSavedAt : init.lastSavedAt,
      lastOperator: typeof parsed.lastOperator === 'string' ? parsed.lastOperator : init.lastOperator,
      lastAction: typeof parsed.lastAction === 'string' ? parsed.lastAction : init.lastAction,
      filterStatePersist: parsed.filterStatePersist && typeof parsed.filterStatePersist === 'object' ? parsed.filterStatePersist : init.filterStatePersist,
    };
  } catch (e) {
    console.error('[store] load persist error:', e);
    return buildInitialPersist();
  }
}

function pickPersistSlice(state: AppState): PersistSlice {
  return {
    confirmedIds: state.confirmedIds,
    anomalyQueue: state.anomalyQueue,
    mergeGroups: state.mergeGroups,
    judgmentsMap: state.judgmentsMap,
    supplementaryMap: state.supplementaryMap,
    statusOverrides: state.statusOverrides,
    lastSavedAt: state.lastSavedAt,
    lastOperator: state.lastOperator,
    lastAction: state.lastAction,
    filterStatePersist: state.filterStatePersist,
  };
}

function computeRecords(persist: PersistSlice): TempControlRecord[] {
  const groups = ensureMergeGroups(persist.mergeGroups, PRESET_MERGE_GROUPS);
  const records = mergeRecordsWithPatch(MOCK_RECORDS, persist, groups);
  return records;
}

function buildInitialState(): AppState {
  const persist = loadPersistFromStorage();
  const restoredFilter: FilterState = { ...DEFAULT_FILTER, ...persist.filterStatePersist };
  persist.mergeGroups = ensureMergeGroups(persist.mergeGroups, PRESET_MERGE_GROUPS);
  const records = computeRecords(persist);
  persist.anomalyQueue = ensureQueue(persist.anomalyQueue, records);
  return {
    ...persist,
    records,
    filterState: restoredFilter,
    drillDown: { ...DEFAULT_DRILLDOWN },
    ui: { ...DEFAULT_UI, hydrateReady: true },
  };
}

function debounce<T extends (...args: any[]) => any>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const persistToStorage = debounce((slice: PersistSlice) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PERSIST_KEY, JSON.stringify(slice));
  } catch (e) {
    console.error('[store] persist write error:', e);
  }
}, 300);

const INITIAL_STATE = buildInitialState();

export const useAppStore = create<AppStore>((set, get) => ({
  ...INITIAL_STATE,

  getRecordById: (id) => get().records.find((r) => r.id === id),

  setFilter: (patch) =>
    set((state) => {
      const newFilter = { ...state.filterState, ...patch };
      const persistPatch: Partial<PersistSlice> = {
        filterStatePersist: {
          category: newFilter.category,
          status: newFilter.status,
          anomaly: newFilter.anomaly,
          weightAbnormal: newFilter.weightAbnormal,
          hasDuplicate: newFilter.hasDuplicate,
        },
      };
      return {
        filterState: newFilter,
        ...persistPatch,
      };
    }),

  setDrillDown: (patch) =>
    set((state) => ({ drillDown: { ...state.drillDown, ...patch } })),

  toggleConfirm: (recordId, confirmed) => {
    const state = get();
    const isConfirmed =
      confirmed !== undefined ? confirmed : !state.confirmedIds.includes(recordId);
    const newConfirmedIds = isConfirmed
      ? state.confirmedIds.includes(recordId)
        ? state.confirmedIds
        : [...state.confirmedIds, recordId]
      : state.confirmedIds.filter((id) => id !== recordId);

    const newStatusOverrides = { ...state.statusOverrides };
    if (isConfirmed) {
      newStatusOverrides[recordId] = 'confirmed';
    } else {
      newStatusOverrides[recordId] = 'pending';
    }

    const patchForRecords: Partial<PersistSlice> = {
      confirmedIds: newConfirmedIds,
      statusOverrides: newStatusOverrides,
      mergeGroups: state.mergeGroups,
      judgmentsMap: state.judgmentsMap,
      supplementaryMap: state.supplementaryMap,
    };
    const newRecords = computeRecords(patchForRecords as PersistSlice);

    const newQueue = ensureQueue(
      state.anomalyQueue.map((q) =>
        q.recordId === recordId ? { ...q, resolved: isConfirmed } : q
      ),
      newRecords
    );

    set({
      confirmedIds: newConfirmedIds,
      anomalyQueue: newQueue,
      statusOverrides: newStatusOverrides,
      records: newRecords,
      lastSavedAt: new Date().toISOString(),
      lastOperator: CURRENT_OPERATOR,
      lastAction: `${isConfirmed ? '确认' : '取消确认'}记录 ${recordId}`,
    });
  },

  addJudgment: (recordId, judgment) => {
    const state = get();
    const newJudgment: JudgmentRecord = {
      ...judgment,
      id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      operator: CURRENT_OPERATOR,
    };
    const prev = state.judgmentsMap[recordId] || [];
    const newJudgmentsMap = {
      ...state.judgmentsMap,
      [recordId]: [...prev, newJudgment],
    };
    const newStatusOverrides = { ...state.statusOverrides, [recordId]: judgment.newStatus };

    const patchForRecords: Partial<PersistSlice> = {
      confirmedIds: state.confirmedIds,
      statusOverrides: newStatusOverrides,
      mergeGroups: state.mergeGroups,
      judgmentsMap: newJudgmentsMap,
      supplementaryMap: state.supplementaryMap,
    };
    const newRecords = computeRecords(patchForRecords as PersistSlice);

    const newQueue = ensureQueue(
      state.anomalyQueue.map((q) =>
        q.recordId === recordId
          ? { ...q, resolved: judgment.newStatus === 'confirmed' }
          : q
      ),
      newRecords
    );
    set({
      judgmentsMap: newJudgmentsMap,
      statusOverrides: newStatusOverrides,
      anomalyQueue: newQueue,
      records: newRecords,
      lastSavedAt: new Date().toISOString(),
      lastOperator: CURRENT_OPERATOR,
      lastAction: `对记录 ${recordId} 进行改判：${judgment.reason}`,
    });
  },

  addSupplementaryNote: (recordId, note) => {
    const state = get();
    const newNote: SupplementaryNote = {
      ...note,
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      author: CURRENT_OPERATOR,
    };
    const prev = state.supplementaryMap[recordId] || [];
    const newSupplementaryMap = {
      ...state.supplementaryMap,
      [recordId]: [...prev, newNote],
    };

    const patchForRecords: Partial<PersistSlice> = {
      confirmedIds: state.confirmedIds,
      statusOverrides: state.statusOverrides,
      mergeGroups: state.mergeGroups,
      judgmentsMap: state.judgmentsMap,
      supplementaryMap: newSupplementaryMap,
    };
    const newRecords = computeRecords(patchForRecords as PersistSlice);

    set({
      supplementaryMap: newSupplementaryMap,
      records: newRecords,
      lastSavedAt: new Date().toISOString(),
      lastOperator: CURRENT_OPERATOR,
      lastAction: `对记录 ${recordId} 添加后补说明`,
    });
  },

  confirmMergeGroup: (groupId) =>
    set((state) => {
      const newMergeGroups = state.mergeGroups.map((mg) =>
        mg.id === groupId ? { ...mg, confirmed: true } : mg
      );
      const patchForRecords: Partial<PersistSlice> = {
        confirmedIds: state.confirmedIds,
        statusOverrides: state.statusOverrides,
        mergeGroups: newMergeGroups,
        judgmentsMap: state.judgmentsMap,
        supplementaryMap: state.supplementaryMap,
      };
      return {
        mergeGroups: newMergeGroups,
        records: computeRecords(patchForRecords as PersistSlice),
        lastSavedAt: new Date().toISOString(),
        lastOperator: CURRENT_OPERATOR,
        lastAction: `确认合并组 ${groupId}`,
      };
    }),

  applyMerge: (groupId) => {
    const state = get();
    const group = state.mergeGroups.find((mg) => mg.id === groupId);
    if (!group) return;
    const newMergeGroups = state.mergeGroups.map((mg) =>
      mg.id === groupId ? { ...mg, confirmed: true } : mg
    );
    const patchForRecords: Partial<PersistSlice> = {
      confirmedIds: state.confirmedIds,
      statusOverrides: state.statusOverrides,
      mergeGroups: newMergeGroups,
      judgmentsMap: state.judgmentsMap,
      supplementaryMap: state.supplementaryMap,
    };
    set({
      mergeGroups: newMergeGroups,
      records: computeRecords(patchForRecords as PersistSlice),
      lastSavedAt: new Date().toISOString(),
      lastOperator: CURRENT_OPERATOR,
      lastAction: `应用合并组 ${groupId}：${group.primaryName} 合并 ${group.aliases.join(', ')}`,
    });
  },

  setOpenDetail: (id) =>
    set((state) => ({
      ui: { ...state.ui, openDetailId: id },
      drillDown: id
        ? { ...state.drillDown, openedRecordId: id, highlightAt: Date.now() }
        : state.drillDown,
    })),

  setShowMergeModal: (show) => set((s) => ({ ui: { ...s.ui, showMergeModal: show } })),
  setShowExportPanel: (show) => set((s) => ({ ui: { ...s.ui, showExportPanel: show } })),
  toggleGuide: () => set((s) => ({ ui: { ...s.ui, showGuide: !s.ui.showGuide } })),
  setQueueWidth: (width) => set((s) => ({ ui: { ...s.ui, queueWidth: width } })),

  saveLastAction: (action) =>
    set(() => ({
      lastSavedAt: new Date().toISOString(),
      lastOperator: CURRENT_OPERATOR,
      lastAction: action,
    })),

  resetAll: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PERSIST_KEY);
      }
    } catch (e) {
      console.error('[store] reset remove error:', e);
    }
    const freshPersist = buildInitialPersist();
    freshPersist.mergeGroups = ensureMergeGroups([], PRESET_MERGE_GROUPS);
    const freshRecords = computeRecords(freshPersist);
    freshPersist.anomalyQueue = buildAnomalyQueue(freshRecords);
    set({
      ...freshPersist,
      records: freshRecords,
      filterState: { ...DEFAULT_FILTER },
      drillDown: { ...DEFAULT_DRILLDOWN },
      ui: { ...DEFAULT_UI, hydrateReady: true },
    });
  },
}));

useAppStore.subscribe((state) => {
  const slice = pickPersistSlice(state);
  persistToStorage(slice);
});
