import { create } from "zustand";
import type {
  SurveyRecord,
  TimelineEvent,
  FilterSnapshot,
  Note,
  StatusLog,
  RecordStatus,
  AppState,
  Anomaly,
} from "../data/types";
import { mockRecords, mockTimeline } from "../data/mockData";
import { detectAll, applyAnomalies } from "../services/anomalyDetector";

export interface ImportReport {
  filename: string;
  format: "json" | "csv";
  totalRows: number;
  importedCount: number;
  anomalyCount: number;
  skippedRows: { row: number; reason: string; raw: string }[];
  anomalies: { recordId: string; station: string; type: string; description: string }[];
}

let tlSeq = 100;
let noteSeq = 100;
let slSeq = 100;
let recSeq = 1000;

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
function recId() {
  recSeq += 1;
  return `rec_imp_${Date.now()}_${recSeq}`;
}

const CSV_FIELD_ALIASES: Record<string, keyof SurveyRecord> = {
  站点: "station",
  station: "station",
  采样时间: "sampledAt",
  sampledAt: "sampledAt",
  sampled_at: "sampledAt",
  时间: "sampledAt",
  潮位: "tideLevel",
  tideLevel: "tideLevel",
  tide: "tideLevel",
  潮位值: "tideLevel",
  水温: "waterTemp",
  waterTemp: "waterTemp",
  temperature: "waterTemp",
  白化率: "bleachingRate",
  bleachingRate: "bleachingRate",
  白化比例: "bleachingRate",
  实验结果: "notes",
  备注: "notes",
  notes: "notes",
  状态: "status",
  status: "status",
};

const STATUS_ALIASES: Record<string, RecordStatus> = {
  待处理: "pending",
  pending: "pending",
  已确认: "confirmed",
  confirmed: "confirmed",
  待补件: "pending_info",
  pending_info: "pending_info",
  退回: "returned",
  returned: "returned",
};

function parseCSV(text: string): Partial<SurveyRecord>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const splitLine = (line: string): string[] => {
    const res: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        res.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    res.push(cur.trim());
    return res;
  };

  const header = splitLine(lines[0]).map((h) => h.trim());
  const fieldMap: (number | null)[] = header.map((h) => {
    const clean = h.replace(/[ "'`]/g, "");
    return CSV_FIELD_ALIASES[clean] !== undefined ? (CSV_FIELD_ALIASES[clean] as unknown as number) : null;
  });

  const rows: Partial<SurveyRecord>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const obj: Partial<SurveyRecord> = {};
    for (let j = 0; j < fieldMap.length; j++) {
      if (fieldMap[j] === null) continue;
      const key = fieldMap[j] as unknown as keyof SurveyRecord;
      const value = cols[j] ?? "";
      if (!value) continue;

      if (key === "waterTemp" || key === "bleachingRate") {
        const n = parseFloat(value.replace(/[^\d.]/g, ""));
        (obj as any)[key] = isNaN(n) ? null : n;
      } else if (key === "status") {
        (obj as any)[key] = STATUS_ALIASES[value] ?? "pending";
      } else if (key === "notes") {
        (obj as any)[key] = [{ id: noteId(), recordId: "", content: value, author: "船上记录", createdAt: new Date().toISOString() }];
      } else {
        (obj as any)[key] = value;
      }
    }
    rows.push(obj);
  }
  return rows;
}

function toSurveyRecord(partial: Partial<SurveyRecord>): SurveyRecord {
  const now = new Date().toISOString();
  const notes =
    (partial.notes as Note[] | undefined)?.map((n) => ({ ...n, id: noteId() })) ?? [];
  return {
    id: partial.id ?? recId(),
    station: partial.station ?? "未命名站点",
    sampledAt: partial.sampledAt ?? now,
    tideLevel: partial.tideLevel ?? "—",
    waterTemp: partial.waterTemp ?? null,
    bleachingRate: partial.bleachingRate ?? null,
    status: partial.status ?? "pending",
    createdBy: partial.createdBy ?? "阿宁",
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
    anomalies: [],
    notes,
    statusLogs: [],
  };
}

interface AppStore extends AppState {
  pushTimeline: (event: Omit<TimelineEvent, "id" | "createdAt" | "operator"> & { operator?: string }) => void;
  loadSampleData: () => void;
  importRecords: (raw: SurveyRecord[]) => ImportReport;
  importFromFile: (file: File) => Promise<ImportReport>;
  setFilters: (filters: Partial<FilterSnapshot>) => void;
  restoreFilters: (snapshot: FilterSnapshot) => void;
  selectRecord: (id: string | null) => void;
  addNote: (recordId: string, content: string, author?: string) => void;
  changeRecordStatus: (recordId: string, toStatus: RecordStatus, operator?: string) => void;
  batchChangeStatus: (recordIds: string[], toStatus: RecordStatus, operator?: string) => void;
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
    return {
      filename: "JSON",
      format: "json",
      totalRows: raw.length,
      importedCount: records.length,
      anomalyCount: anomalies.length,
      skippedRows: [],
      anomalies: anomalies.map((a) => {
        const r = raw.find((x) => x.id === a.recordId);
        return { recordId: a.recordId, station: r?.station ?? "—", type: a.type, description: a.description };
      }),
    };
  },

  importFromFile: async (file) => {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    let format: "json" | "csv" = "json";
    let partials: Partial<SurveyRecord>[] = [];
    let skipped: { row: number; reason: string; raw: string }[] = [];

    if (lower.endsWith(".json")) {
      format = "json";
      try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : [];
        list.forEach((r, i) => {
          if (typeof r === "object" && r !== null) {
            partials.push(r);
          } else {
            skipped.push({ row: i + 1, reason: "记录非对象", raw: String(r) });
          }
        });
      } catch (e) {
        skipped.push({ row: 1, reason: "JSON 解析失败", raw: text.slice(0, 80) });
      }
    } else if (lower.endsWith(".csv")) {
      format = "csv";
      const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
      const rows = parseCSV(text);
      rows.forEach((p, i) => {
        const hasStation = p.station && p.station.trim() !== "";
        const hasTime = p.sampledAt && p.sampledAt.trim() !== "";
        if (!hasStation && !hasTime) {
          skipped.push({ row: i + 2, reason: "缺少站点与时间关键字段", raw: lines[i + 1] ?? "" });
        } else {
          partials.push(p);
        }
      });
    } else {
      skipped.push({ row: 1, reason: "不支持的文件类型", raw: file.name });
    }

    const records = partials.map(toSurveyRecord);
    const anomalies = detectAll(records);
    const applied = applyAnomalies(records, anomalies);
    set((s) => ({ records: [...s.records, ...applied] }));

    get().pushTimeline({
      eventType: "import",
      description: `导入文件「${file.name}」：${applied.length} 条记录成功，${skipped.length} 条跳过`,
    });
    if (anomalies.length > 0) {
      get().pushTimeline({
        eventType: "detect",
        description: `新导入数据检测出 ${anomalies.length} 处异常`,
        operator: "系统",
      });
    }

    return {
      filename: file.name,
      format,
      totalRows: partials.length + skipped.length,
      importedCount: applied.length,
      anomalyCount: anomalies.length,
      skippedRows: skipped,
      anomalies: anomalies.map((a: Anomaly) => {
        const r = applied.find((x) => x.id === a.recordId);
        return { recordId: a.recordId, station: r?.station ?? "—", type: a.type, description: a.description };
      }),
    };
  },

  setFilters: (filters) => {
    const next: FilterSnapshot = { ...get().activeFilters, ...filters, id: filtId() };
    set({ activeFilters: next });
    get().pushTimeline({ eventType: "filter", description: "更新筛选条件", filterSnapshot: next });
  },

  restoreFilters: (snapshot) => {
    const next: FilterSnapshot = { ...snapshot, id: filtId() };
    set({ activeFilters: next, view: "workbench" });
    get().pushTimeline({
      eventType: "filter",
      description: "从历史时间线还原筛选口径",
      filterSnapshot: next,
    });
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

  batchChangeStatus: (recordIds, toStatus, operator) => {
    const op = operator ?? "阿宁";
    const now = new Date().toISOString();
    let changed = 0;
    const logs: StatusLog[] = [];
    set((s) => {
      const newRecords = s.records.map((r) => {
        if (!recordIds.includes(r.id) || r.status === toStatus) return r;
        const log: StatusLog = {
          id: slId(),
          recordId: r.id,
          fromStatus: r.status,
          toStatus,
          operator: op,
          createdAt: now,
        };
        logs.push(log);
        changed += 1;
        return { ...r, status: toStatus, statusLogs: [...r.statusLogs, log], updatedAt: now };
      });
      return { records: newRecords };
    });
    if (changed > 0) {
      get().pushTimeline({
        eventType: "status_change",
        description: `批量变更 ${changed} 条记录状态 → ${toStatus}`,
        operator: op,
      });
    }
  },

  setView: (v) => set({ view: v, selectedRecordId: null }),

  exportCurrent: () => {
    const filtered = get().getFilteredRecords();
    const { timeline, activeFilters } = get();
    const payload = {
      exportedAt: new Date().toISOString(),
      filters: activeFilters,
      summary: {
        totalFiltered: filtered.length,
        byStatus: filtered.reduce<Record<string, number>>((acc, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        }, {}),
        anomalyCount: filtered.reduce((s, r) => s + r.anomalies.length, 0),
      },
      records: filtered,
      timeline,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coral_bleaching_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    get().pushTimeline({
      eventType: "export",
      description: `导出 ${filtered.length} 条记录（共 ${payload.summary.anomalyCount} 处异常）`,
    });
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
