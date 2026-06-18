import { create } from "zustand";
import {
  ANOMALIES,
  BUOY_LOGS,
  HISTORY_VERSIONS,
  MANUAL_RECORDS,
  SPEC_V3,
  SUPPLEMENTARY_NOTES,
  TIME_RANGE,
} from "@/data/mockData";
import type { AnomalyEvent, HistoryVersion, MetricKey } from "@/types";

interface PlaybackState {
  timeRange: [number, number];
  cursor: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  selectedMetricKeys: MetricKey[];
  showManualPoints: boolean;
  anomalies: AnomalyEvent[];
  selectedAnomalyId: string | null;
  activeVersionTag: string;
  history: HistoryVersion[];
  quickStartVisible: boolean;
  historyDrawerOpen: boolean;
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
  triggerSupplementRerun: () => void;
  toggleQuickStart: (v?: boolean) => void;
  toggleHistoryDrawer: (v?: boolean) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  timeRange: TIME_RANGE,
  cursor: TIME_RANGE[0] + 150 * 60000,
  playing: false,
  speed: 1,
  selectedMetricKeys: ["dissolvedOxygen", "turbidity", "ph", "tideLevel"],
  showManualPoints: true,
  anomalies: ANOMALIES,
  selectedAnomalyId: ANOMALIES[0].id,
  activeVersionTag: HISTORY_VERSIONS[HISTORY_VERSIONS.length - 1].versionTag,
  history: HISTORY_VERSIONS,
  quickStartVisible: true,
  historyDrawerOpen: false,

  jumpToNext(kind) {
    const { anomalies, cursor, timeRange } = get();
    const list = kind
      ? anomalies.filter((a) => (kind === "anomaly" ? a.type === "anomaly" : a.type === "pending_confirmation"))
      : anomalies;
    const next = list.find((a) => a.timestamp > cursor) ?? list[0];
    if (next) set({ cursor: Math.min(Math.max(next.timestamp, timeRange[0]), timeRange[1]) });
  },
  jumpToPrev(kind) {
    const { anomalies, cursor, timeRange } = get();
    const list = kind
      ? anomalies.filter((a) => (kind === "anomaly" ? a.type === "anomaly" : a.type === "pending_confirmation"))
      : anomalies;
    const prev = [...list].reverse().find((a) => a.timestamp < cursor) ?? list[list.length - 1];
    if (prev) set({ cursor: Math.min(Math.max(prev.timestamp, timeRange[0]), timeRange[1]) });
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
  triggerSupplementRerun() {
    const { history } = get();
    const next: HistoryVersion = {
      id: `H-V${history.length + 1}`,
      versionTag: `v${history.length + 1}`,
      createdAt: Date.now(),
      createdBy: "阿乔",
      trigger: "supplement_rerun",
      hasManualEdit: true,
      manualEditFields: ["unitConversions.tideLevel"],
      spec: { ...SPEC_V3, id: `SPEC-V${history.length + 1}`, version: `v${history.length + 1}`, timestamp: Date.now() },
      continuityReport: { hasGaps: false, gaps: [] },
    };
    set({
      history: [...history, next],
      activeVersionTag: next.versionTag,
      anomalies: get().anomalies.map((a) =>
        a.id === "A-02" ? { ...a, confirmed: true, confirmedBy: "阿乔" } : a,
      ),
    });
  },
  toggleQuickStart(v) {
    set({ quickStartVisible: typeof v === "boolean" ? v : !get().quickStartVisible });
  },
  toggleHistoryDrawer(v) {
    set({ historyDrawerOpen: typeof v === "boolean" ? v : !get().historyDrawerOpen });
  },
}));

export const selectBuoyLogs = () => BUOY_LOGS;
export const selectManualRecords = () => MANUAL_RECORDS;
export const selectSupplementaryNotes = () => SUPPLEMENTARY_NOTES;
