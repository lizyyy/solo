import { create } from "zustand";
import type {
  SurveyRecord,
  TimelineEvent,
  FilterSnapshot,
  Note,
  StatusLog,
  RecordStatus,
  AppState,
} from "../data/types";
import { mockRecords, mockTimeline } from "../data/mockData";
import { detectAll, applyAnomalies } from "../services/anomalyDetector";

let tlSeq = 100;
let noteSeq = 100;
let slSeq = 100;

function tlId() {
  tlSeq += 1;
  return `tl_${Date.now()}_${tlSeq}`;
}
function noteId() {
  noteSeq += 1;
  return `note_${Date.now()}_${noteSeq}`;
}
function slId() {
  slSeq += 1;
  return `sl_${Date.now()}_${slSeq}`;
}
function filtId() {
  return `filt_${Date.now()}`;
}

interface AppStore extends AppState {
  pushTimeline: (event: Omit<TimelineEvent, "id" | "createdAt" | "operator"> & { operator?: string }) => void;
  loadSampleData: () => void;
  importRecords: (raw: SurveyRecord[]) => void;
  setFilters: (filters: Partial<FilterSnapshot>) => void;
  selectRecord: (id: string | null) => void;
  addNote: (recordId: string, content: string, author?: string) => void;
  changeRecordStatus: (recordId: string, toStatus: RecordStatus, operator?: string) => void;
  setView: (v: AppState["view"]) => void;
  exportCurrent: () => void;
  rerunDetection: () => void;
  getFilteredRecords: () => SurveyRecord[];
}

const DEFAULT_FILTERS: FilterSnapshot = { id: filtId() };

export const useAppStore = create<AppStore>((set, get) => ({
  records: [],
  timeline: [],
  activeFilters: DEFAULT_FILTERS,
  selectedRecordId: null,
  view: "workbench",

  pushTimeline: (event) => {
    const full: TimelineEvent = {
      ...event,
      id: tlId(),
      createdAt: new Date().toISOString(),
      operator: event.operator ?? "阿宁",
    };
    set((s) => ({ timeline: [...s.timeline, full] }));
  },

  loadSampleData: () => {
    const anomalies = detectAll(mockRecords);
    const records = applyAnomalies(mockRecords, anomalies);
    set({ records, timeline: [...mockTimeline] });
    const count = anomalies.length;
    if (count > 0) {
      get().pushTimeline({
        eventType: "detect",
        description: `加载样例数据后自动检测，发现 ${count} 处异常`,
        operator: "系统",
      });
    }
  },

  importRecords: (raw) => {
    const anomalies = detectAll(raw);
    const records = applyAnomalies(raw, anomalies);
    set((s) => ({ records: [...s.records, ...records] }));
    get().pushTimeline({ eventType: "import", description: `导入 ${raw.length} 条记录` });
    if (anomalies.length > 0) {
      get().pushTimeline({
        eventType: "detect",
        description: `新导入数据检测出 ${anomalies.length} 处异常`,
        operator: "系统",
      });
    }
  },

  setFilters: (filters) => {
    const next: FilterSnapshot = { ...get().activeFilters, ...filters, id: filtId() };
    set({ activeFilters: next });
    get().pushTimeline({ eventType: "filter", description: "更新筛选条件", filterSnapshot: next });
  },

  selectRecord: (id) => set({ selectedRecordId: id }),

  addNote: (recordId, content, author) => {
    const note: Note = {
      id: noteId(),
      recordId,
      content,
      author: author ?? "阿宁",
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId ? { ...r, notes: [...r.notes, note], updatedAt: new Date().toISOString() } : r
      ),
    }));
    get().pushTimeline({
      eventType: "note",
      description: `添加后补备注：${content.length > 20 ? content.slice(0, 20) + "…" : content}`,
      recordId,
      operator: author,
    });
  },

  changeRecordStatus: (recordId, toStatus, operator) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return;
    const fromStatus = record.status;
    const log: StatusLog = {
      id: slId(),
      recordId,
      fromStatus,
      toStatus,
      operator: operator ?? "阿宁",
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId
          ? { ...r, status: toStatus, statusLogs: [...r.statusLogs, log], updatedAt: new Date().toISOString() }
          : r
      ),
    }));
    get().pushTimeline({
      eventType: "status_change",
      description: `状态变更：${fromStatus} → ${toStatus}`,
      recordId,
      operator,
    });
  },

  setView: (v) => set({ view: v, selectedRecordId: null }),

  exportCurrent: () => {
    const filtered = get().getFilteredRecords();
    const { timeline, activeFilters } = get();
    const blob = new Blob(
      [
        JSON.stringify(
          { records: filtered, timeline, filters: activeFilters, exportedAt: new Date().toISOString() },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coral_bleaching_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    get().pushTimeline({ eventType: "export", description: `导出 ${filtered.length} 条记录` });
  },

  rerunDetection: () => {
    const anomalies = detectAll(get().records);
    const records = applyAnomalies(get().records, anomalies);
    set({ records });
    get().pushTimeline({
      eventType: "detect",
      description: `重新运行检测，发现 ${anomalies.length} 处异常`,
      operator: "系统",
    });
  },

  getFilteredRecords: () => {
    const { records, activeFilters: f } = get();
    return records.filter((r) => {
      if (f.station && r.station !== f.station) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.anomalyType && !r.anomalies.some((a) => a.type === f.anomalyType)) return false;
      if (f.dateFrom && r.sampledAt < f.dateFrom) return false;
      if (f.dateTo && r.sampledAt > f.dateTo) return false;
      if (f.keyword) {
        const kw = f.keyword.toLowerCase();
        const inStation = r.station.toLowerCase().includes(kw);
        const inTide = r.tideLevel.toLowerCase().includes(kw);
        const inNote = r.notes.some((n) => n.content.toLowerCase().includes(kw));
        if (!inStation && !inTide && !inNote) return false;
      }
      return true;
    });
  },
}));

useAppStore.getState().loadSampleData();
