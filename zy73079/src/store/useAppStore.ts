import { create } from 'zustand';
import type {
  InspectionRecord,
  Remark,
  AnomalyAttribution,
  PartReplacement,
  ImportLog,
  CalculationCriterion,
  ReportSection,
  JudgementImpact,
} from '../types';
import {
  generateId,
  dedupInspectionRecords,
} from '../utils';
import {
  MOCK_CRITERION,
  buildAllMock,
  DEVICE_ID,
} from '../utils/mockData';

const LS_KEYS = {
  inspections: 'cutter_inspections_v1',
  remarks: 'cutter_remarks_v1',
  attributions: 'cutter_attributions_v1',
  replacements: 'cutter_replacements_v1',
  importLogs: 'cutter_import_logs_v1',
  criterion: 'cutter_criterion_v1',
  reportSections: 'cutter_report_sections_v1',
  initialized: 'cutter_initialized_v1',
};

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLS<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

export interface AppState {
  selectedInspectionId: string | null;
  selectedAnomalyId: string | null;
  activeTab: 'detail' | 'remark' | 'replace' | 'import' | 'report';
  showCriterion: boolean;
  showRemarkForm: boolean;
  pendingImportPreview: {
    fileName: string;
    preview: InspectionRecord[];
    duplicateCount: number;
    preservedRemarkCount: number;
  } | null;
  scrollToReportId: string | null;
  inspections: InspectionRecord[];
  remarks: Remark[];
  attributions: AnomalyAttribution[];
  replacements: PartReplacement[];
  importLogs: ImportLog[];
  criterion: CalculationCriterion;
  reportSections: ReportSection[];
  toast: { message: string; type: 'success' | 'warn' | 'error' } | null;
}

export interface AppActions {
  initIfNeeded: () => void;
  setSelectedInspection: (id: string | null) => void;
  setSelectedAnomaly: (id: string | null) => void;
  setActiveTab: (t: AppState['activeTab']) => void;
  toggleCriterion: () => void;
  toggleRemarkForm: (open?: boolean) => void;
  setPendingImportPreview: (p: AppState['pendingImportPreview']) => void;
  setScrollToReportId: (id: string | null) => void;
  addSupplementaryRemark: (p: {
    inspectionId: string;
    content: string;
    author: string;
    impacts: Array<Omit<JudgementImpact, 'id'>>;
    reportAnchorId?: string;
  }) => void;
  addPartReplacement: (
    p: Omit<PartReplacement, 'id' | 'relatedInspectionIds'> & {
      relatedInspectionIds?: string[];
    }
  ) => void;
  confirmAnomaly: (anomalyId: string, by: string) => void;
  clarifyAnomalyByRemark: (anomalyId: string, remarkId: string, by: string) => void;
  confirmImport: () => ImportLog;
  cancelImport: () => void;
  previewImport: (fileName: string, records: InspectionRecord[]) => void;
  generateDuplicateForTest: () => InspectionRecord[];
  setToast: (t: AppState['toast']) => void;
  dismissToast: () => void;
  resetAll: () => void;
}

export type AppStore = AppState & AppActions;

function injectMock(state: Partial<AppState>): Partial<AppState> {
  const { inspections, remarks, attributions, replacements, sections } =
    buildAllMock();
  return {
    ...state,
    inspections,
    remarks,
    attributions,
    replacements,
    reportSections: sections,
    criterion: MOCK_CRITERION,
    importLogs: [],
    selectedInspectionId: inspections[2].id,
    selectedAnomalyId: attributions[1].id,
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  selectedInspectionId: null,
  selectedAnomalyId: null,
  activeTab: 'detail',
  showCriterion: false,
  showRemarkForm: false,
  pendingImportPreview: null,
  scrollToReportId: null,
  inspections: [],
  remarks: [],
  attributions: [],
  replacements: [],
  importLogs: [],
  criterion: MOCK_CRITERION,
  reportSections: [],
  toast: null,

  initIfNeeded: () => {
    const initialized = loadLS<boolean>(LS_KEYS.initialized, false);
    if (initialized) {
      set({
        inspections: loadLS<InspectionRecord[]>(LS_KEYS.inspections, []),
        remarks: loadLS<Remark[]>(LS_KEYS.remarks, []),
        attributions: loadLS<AnomalyAttribution[]>(LS_KEYS.attributions, []),
        replacements: loadLS<PartReplacement[]>(LS_KEYS.replacements, []),
        importLogs: loadLS<ImportLog[]>(LS_KEYS.importLogs, []),
        criterion: loadLS<CalculationCriterion>(LS_KEYS.criterion, MOCK_CRITERION),
        reportSections: loadLS<ReportSection[]>(LS_KEYS.reportSections, []),
      });
      const st = get();
      if (st.inspections.length > 0 && !st.selectedInspectionId) {
        const alarmRec = st.inspections.find((i) => i.isAlarm) || st.inspections[0];
        set({ selectedInspectionId: alarmRec.id });
      }
      return;
    }
    const injected = injectMock({}) as AppState;
    Object.entries(LS_KEYS).forEach(([k, v]) => {
      if (k === 'initialized') return;
      const key = k as keyof typeof LS_KEYS;
      const val = (injected as unknown as Record<string, unknown>)[key];
      if (val !== undefined) saveLS(v, val);
    });
    saveLS(LS_KEYS.initialized, true);
    set(injected);
  },

  setSelectedInspection: (id) => set({ selectedInspectionId: id }),
  setSelectedAnomaly: (id) => set({ selectedAnomalyId: id }),
  setActiveTab: (t) => set({ activeTab: t }),
  toggleCriterion: () => set((s) => ({ showCriterion: !s.showCriterion })),
  toggleRemarkForm: (open) =>
    set((s) => ({ showRemarkForm: open ?? !s.showRemarkForm })),
  setPendingImportPreview: (p) => set({ pendingImportPreview: p }),
  setScrollToReportId: (id) => {
    set({ scrollToReportId: id });
    if (id) setTimeout(() => set({ scrollToReportId: null }), 3000);
  },

  addSupplementaryRemark: (p) => {
    const r: Remark = {
      id: generateId(),
      inspectionId: p.inspectionId,
      content: p.content,
      author: p.author,
      createdAt: Date.now(),
      isSupplementary: true,
      supplementaryTime: Date.now(),
      judgementImpacts: p.impacts.map((i) => ({ ...i, id: generateId() })),
      reportAnchorId: p.reportAnchorId,
    };
    set((s) => {
      const remarks = [...s.remarks, r];
      const updatedAt = Date.now();
      const inspections = s.inspections.map((i) =>
        i.id === p.inspectionId ? { ...i, updatedAt } : i
      );
      saveLS(LS_KEYS.remarks, remarks);
      saveLS(LS_KEYS.inspections, inspections);
      return {
        remarks,
        inspections,
        showRemarkForm: false,
        toast: { message: '补录备注已保存，已同步更新归因判断', type: 'success' },
      };
    });
  },

  addPartReplacement: (p) => {
    const rec: PartReplacement = {
      ...p,
      id: generateId(),
      relatedInspectionIds: p.relatedInspectionIds || [],
    };
    set((s) => {
      const replacements = [...s.replacements, rec];
      saveLS(LS_KEYS.replacements, replacements);
      return {
        replacements,
        activeTab: 'replace',
        toast: { message: `备件替换记录已单独保存：${rec.partName} ${rec.oldModel} → ${rec.newModel}`, type: 'success' },
      };
    });
  },

  confirmAnomaly: (anomalyId, by) => {
    set((s) => {
      const attributions = s.attributions.map((a) =>
        a.id === anomalyId
          ? { ...a, status: 'confirmed' as const, confirmedBy: by, confirmedAt: Date.now() }
          : a
      );
      saveLS(LS_KEYS.attributions, attributions);
      return { attributions };
    });
  },

  clarifyAnomalyByRemark: (anomalyId, remarkId, by) => {
    set((s) => {
      const attributions = s.attributions.map((a) =>
        a.id === anomalyId
          ? {
              ...a,
              status: 'clarified' as const,
              clarifiedRemarkId: remarkId,
              confirmedBy: by,
              confirmedAt: Date.now(),
            }
          : a
      );
      saveLS(LS_KEYS.attributions, attributions);
      return { attributions };
    });
  },

  previewImport: (fileName, records) => {
    const { duplicateCount, preservedRemarkCount } = dedupInspectionRecords(
      records,
      get().inspections,
      get().remarks
    );
    set({
      pendingImportPreview: {
        fileName,
        preview: records,
        duplicateCount,
        preservedRemarkCount,
      },
    });
  },

  generateDuplicateForTest: () => {
    const st = get();
    if (st.inspections.length === 0) return [];
    const src = st.inspections[st.inspections.length - 1];
    const dup: InspectionRecord[] = st.inspections
      .slice(-2)
      .map((r, idx) => ({
        ...r,
        id: generateId(),
        temperature: r.temperature + (idx === 0 ? 0.5 : -0.3),
        sourceImportId: 'dup-test-' + generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    dup.push({
      id: generateId(),
      deviceId: DEVICE_ID,
      inspectionTime: src.inspectionTime + 1800 * 1000,
      inspector: '巡检-新同事',
      temperature: 61,
      vibration: 3.0,
      rotationSpeed: 1.18,
      cutterWear: 12.3,
      isAlarm: false,
      sourceImportId: 'dup-test-new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return dup;
  },

  confirmImport: () => {
    const st = get();
    const p = st.pendingImportPreview;
    if (!p) throw new Error('no pending import');
    const { inserted, updated, duplicateCount, preservedRemarkCount } =
      dedupInspectionRecords(p.preview, st.inspections, st.remarks);
    const idMap = new Map<string, string>();
    updated.forEach((u) => idMap.set(u.id, u.id));
    const inspections = [
      ...st.inspections.filter(
        (i) => !updated.some((u) => u.id === i.id)
      ),
      ...inserted,
      ...updated,
    ].sort((a, b) => a.inspectionTime - b.inspectionTime);
    const log: ImportLog = {
      id: generateId(),
      importTime: Date.now(),
      fileName: p.fileName,
      totalRecords: p.preview.length,
      duplicateRecords: duplicateCount,
      preservedRemarks: preservedRemarkCount,
      status: duplicateCount === p.preview.length ? 'partial' : 'success',
    };
    const importLogs = [log, ...st.importLogs];
    saveLS(LS_KEYS.inspections, inspections);
    saveLS(LS_KEYS.importLogs, importLogs);
    set({
      inspections,
      importLogs,
      pendingImportPreview: null,
      toast: {
        message: `导入完成：新增${inserted.length}条，去重${duplicateCount}条，保护备注${preservedRemarkCount}条`,
        type: preservedRemarkCount > 0 ? 'warn' : 'success',
      },
    });
    return log;
  },

  cancelImport: () => set({ pendingImportPreview: null }),

  setToast: (t) => set({ toast: t }),
  dismissToast: () => set({ toast: null }),

  resetAll: () => {
    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
    location.reload();
  },
}));
