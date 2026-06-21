import { create } from "zustand";
import {
  ANOMALIES,
  BUOY_LOGS,
  HISTORY_VERSIONS,
  MANUAL_RECORDS,
  SUPPLEMENTARY_NOTES,
  TIME_RANGE,
} from "@/data/mockData";
import type {
  AnomalyEvent,
  BuoyLog,
  CalculationSpec,
  HistoryVersion,
  ManualRecord,
  MetricKey,
  SupplementaryNote,
} from "@/types";

interface SupplementRerunInput {
  author: string;
  note: string;
  targetAnomalyId?: string;
}

interface PlaybackState {
  timeRange: [number, number];
  cursor: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  selectedMetricKeys: MetricKey[];
  showManualPoints: boolean;
  buoyLogs: BuoyLog[];
  manualRecords: ManualRecord[];
  supplementaryNotes: SupplementaryNote[];
  anomalies: AnomalyEvent[];
  selectedAnomalyId: string | null;
  activeVersionTag: string;
  history: HistoryVersion[];
  quickStartVisible: boolean;
  historyDrawerOpen: boolean;
  lastRerunInfo: { versionTag: string; at: number } | null;
  jumpToNext: (kind?: "anomaly" | "pending") => void;
  jumpToPrev: (kind?: "anomaly" | "pending") => void;
  setCursor: (ts: number) => void;
  togglePlay: () => void;
  setSpeed: (s: 1 | 2 | 4) => void;
  toggleMetric: (k: MetricKey) => void;
  toggleManualPoints: () => void;
  selectAnomaly: (id: string | null) => void;
  confirmAnomaly: (id: string) => void;
  setActiveVersion: (tag: string) => void;
  addSupplementaryNote: (note: Omit<SupplementaryNote, "id" | "attachedAt">) => void;
  triggerSupplementRerun: (input: SupplementRerunInput) => HistoryVersion;
  toggleQuickStart: (v?: boolean) => void;
  toggleHistoryDrawer: (v?: boolean) => void;
  clearLastRerunInfo: () => void;
}

function buildNextSpec(base: CalculationSpec, version: string): CalculationSpec {
  return {
    ...base,
    id: `SPEC-${version}`,
    version,
    timestamp: Date.now(),
    unitConversions: {
      ...base.unitConversions,
      tideLevel: "m (cm 自动 ×0.01，人工补录已统一)",
    },
    formula:
      base.formula +
      "；人工补录确认 B-09/B-10 潮位为传感器误写 cm，已按 cm×0.01 修正为 m",
    thresholds: { ...base.thresholds },
  };
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  timeRange: TIME_RANGE,
  cursor: TIME_RANGE[0] + 150 * 60000,
  playing: false,
  speed: 1,
  selectedMetricKeys: ["dissolvedOxygen", "turbidity", "ph", "tideLevel"],
  showManualPoints: true,
  buoyLogs: BUOY_LOGS.map((l) => ({ ...l })),
  manualRecords: MANUAL_RECORDS.map((r) => ({ ...r })),
  supplementaryNotes: SUPPLEMENTARY_NOTES.map((n) => ({ ...n })),
  anomalies: ANOMALIES.map((a) => ({ ...a })),
  selectedAnomalyId: ANOMALIES[0].id,
  activeVersionTag: HISTORY_VERSIONS[HISTORY_VERSIONS.length - 1].versionTag,
  history: HISTORY_VERSIONS.map((h) => ({ ...h })),
  quickStartVisible: true,
  historyDrawerOpen: false,
  lastRerunInfo: null,

  jumpToNext(kind) {
    const { anomalies, cursor, timeRange } = get();
    const list = kind
      ? anomalies.filter((a) =>
          kind === "anomaly" ? a.type === "anomaly" : a.type === "pending_confirmation",
        )
      : anomalies;
    const next = list.find((a) => a.timestamp > cursor) ?? list[0];
    if (next)
      set({ cursor: Math.min(Math.max(next.timestamp, timeRange[0]), timeRange[1]) });
  },
  jumpToPrev(kind) {
    const { anomalies, cursor, timeRange } = get();
    const list = kind
      ? anomalies.filter((a) =>
          kind === "anomaly" ? a.type === "anomaly" : a.type === "pending_confirmation",
        )
      : anomalies;
    const prev = [...list].reverse().find((a) => a.timestamp < cursor) ?? list[list.length - 1];
    if (prev)
      set({ cursor: Math.min(Math.max(prev.timestamp, timeRange[0]), timeRange[1]) });
  },
  setCursor(ts) {
    const { timeRange } = get();
    set({ cursor: Math.min(Math.max(ts, timeRange[0]), timeRange[1]) });
  },
  togglePlay() {
    set({ playing: !get().playing });
  },
  setSpeed(s) {
    set({ speed: s });
  },
  toggleMetric(k) {
    const arr = get().selectedMetricKeys;
    set({
      selectedMetricKeys: arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k],
    });
  },
  toggleManualPoints() {
    set({ showManualPoints: !get().showManualPoints });
  },
  selectAnomaly(id) {
    set({ selectedAnomalyId: id });
    if (id) {
      const a = get().anomalies.find((x) => x.id === id);
      if (a) set({ cursor: a.timestamp });
    }
  },
  confirmAnomaly(id) {
    set({
      anomalies: get().anomalies.map((a) =>
        a.id === id ? { ...a, confirmed: true, confirmedBy: "阿乔" } : a,
      ),
    });
  },
  setActiveVersion(tag) {
    set({ activeVersionTag: tag });
  },
  addSupplementaryNote(note) {
    set({
      supplementaryNotes: [
        ...get().supplementaryNotes,
        { ...note, id: `N-${Date.now()}`, attachedAt: Date.now() },
      ],
    });
  },
  triggerSupplementRerun(input) {
    const state = get();
    const nextVersionIdx = state.history.length + 1;
    const nextTag = `v${nextVersionIdx}`;
    const prevVer = state.history[state.history.length - 1];

    const targetId = input.targetAnomalyId ?? state.selectedAnomalyId;
    const related = state.anomalies.find((a) => a.id === targetId);

    const relatedTimeRange: [number, number] = related
      ? [related.timestamp - 60 * 60000, related.timestamp + 60 * 60000]
      : state.timeRange;

    const newNote: SupplementaryNote = {
      id: `N-${Date.now()}`,
      attachedAt: Date.now(),
      author: input.author || "阿乔",
      content: input.note,
      relatedTimeRange,
    };

    const fixedBuoyLogs = state.buoyLogs.map((l) => {
      if (l.tideUnit === "cm") {
        return { ...l, tideLevel: l.tideLevel / 100, tideUnit: "m" as const, _correctedFromCm: true };
      }
      return l;
    });

    const newSpec = buildNextSpec(prevVer.spec, nextTag);

    const nextVersion: HistoryVersion = {
      id: `H-V${nextVersionIdx}`,
      versionTag: nextTag,
      createdAt: Date.now(),
      createdBy: input.author || "阿乔",
      trigger: "supplement_rerun",
      hasManualEdit: true,
      manualEditFields: [
        "unitConversions.tideLevel",
        "formula",
        "supplementaryNotes",
        "buoyLogs.corrected",
      ],
      spec: newSpec,
      continuityReport: { hasGaps: false, gaps: [] },
    };

    set({
      supplementaryNotes: [...state.supplementaryNotes, newNote],
      buoyLogs: fixedBuoyLogs,
      anomalies: state.anomalies.map((a) =>
        a.id === targetId ? { ...a, confirmed: true, confirmedBy: input.author || "阿乔" } : a,
      ),
      history: [...state.history, nextVersion],
      activeVersionTag: nextTag,
      lastRerunInfo: { versionTag: nextTag, at: Date.now() },
    });

    return nextVersion;
  },
  toggleQuickStart(v) {
    set({ quickStartVisible: typeof v === "boolean" ? v : !get().quickStartVisible });
  },
  toggleHistoryDrawer(v) {
    set({ historyDrawerOpen: typeof v === "boolean" ? v : !get().historyDrawerOpen });
  },
  clearLastRerunInfo() {
    set({ lastRerunInfo: null });
  },
}));

export const selectBuoyLogs = () => usePlaybackStore.getState().buoyLogs;
export const selectManualRecords = () => usePlaybackStore.getState().manualRecords;
export const selectSupplementaryNotes = () => usePlaybackStore.getState().supplementaryNotes;
