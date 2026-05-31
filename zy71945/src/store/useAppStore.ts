import { create } from "zustand";
import type {
  OrbitalElement,
  TelemetrySegment,
  WindowTable,
  OcclusionEvent,
  MissingFrameAlert,
  ReviewRecord,
  ReviewHistory,
  TimeRange,
} from "@/types";
import {
  getAllFromStore,
  putBatchToStore,
  putToStore,
  getByIndex,
} from "@/db";
import { analyzeOcclusion } from "@/utils/analysis";
import { generateId } from "@/utils/timeFormat";

interface AppState {
  orbitalElements: OrbitalElement[];
  telemetrySegments: TelemetrySegment[];
  windowTables: WindowTable[];
  occlusionEvents: OcclusionEvent[];
  missingFrameAlerts: MissingFrameAlert[];
  reviewRecords: ReviewRecord[];
  reviewHistory: ReviewHistory[];
  timeRange: TimeRange;
  selectedEventId: string | null;
  isAnalyzing: boolean;

  loadData: () => Promise<void>;
  setOrbitalElements: (items: OrbitalElement[]) => void;
  setTelemetrySegments: (items: TelemetrySegment[]) => void;
  setWindowTables: (items: WindowTable[]) => void;
  addOrbitalElements: (items: OrbitalElement[]) => Promise<void>;
  addTelemetrySegments: (items: TelemetrySegment[]) => Promise<void>;
  addWindowTables: (items: WindowTable[]) => Promise<void>;
  runAnalysis: () => Promise<void>;
  confirmEvent: (eventId: string, reviewer: string) => Promise<void>;
  modifyEvent: (
    eventId: string,
    corrections: { field: string; oldValue: string; newValue: string }[],
    reviewer: string
  ) => Promise<void>;
  markPending: (eventId: string, reviewer: string) => Promise<void>;
  setSelectedEventId: (id: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  orbitalElements: [],
  telemetrySegments: [],
  windowTables: [],
  occlusionEvents: [],
  missingFrameAlerts: [],
  reviewRecords: [],
  reviewHistory: [],
  timeRange: { start: Date.now() - 86400000, end: Date.now() + 86400000 },
  selectedEventId: null,
  isAnalyzing: false,

  loadData: async () => {
    const [oe, ts, wt, events, alerts, records, history] = await Promise.all([
      getAllFromStore<OrbitalElement>("orbital_elements"),
      getAllFromStore<TelemetrySegment>("telemetry_segments"),
      getAllFromStore<WindowTable>("window_tables"),
      getAllFromStore<OcclusionEvent>("occlusion_events"),
      getAllFromStore<MissingFrameAlert>("missing_frame_alerts"),
      getAllFromStore<ReviewRecord>("review_records"),
      getAllFromStore<ReviewHistory>("review_history"),
    ]);

    const allTimes = [
      ...oe.map((o) => o.epochTime),
      ...ts.flatMap((s) => [s.startTime, s.endTime]),
      ...wt.flatMap((w) => [w.startTime, w.endTime]),
    ].filter(Boolean);

    const timeRange: TimeRange =
      allTimes.length > 0
        ? { start: Math.min(...allTimes), end: Math.max(...allTimes) }
        : { start: Date.now() - 86400000, end: Date.now() + 86400000 };

    set({
      orbitalElements: oe,
      telemetrySegments: ts,
      windowTables: wt,
      occlusionEvents: events,
      missingFrameAlerts: alerts,
      reviewRecords: records,
      reviewHistory: history,
      timeRange,
    });
  },

  setOrbitalElements: (items) => set({ orbitalElements: items }),
  setTelemetrySegments: (items) => set({ telemetrySegments: items }),
  setWindowTables: (items) => set({ windowTables: items }),

  addOrbitalElements: async (items) => {
    await putBatchToStore("orbital_elements", items);
    set((s) => ({ orbitalElements: [...s.orbitalElements, ...items] }));
  },

  addTelemetrySegments: async (items) => {
    await putBatchToStore("telemetry_segments", items);
    set((s) => ({ telemetrySegments: [...s.telemetrySegments, ...items] }));
  },

  addWindowTables: async (items) => {
    await putBatchToStore("window_tables", items);
    set((s) => ({ windowTables: [...s.windowTables, ...items] }));
  },

  runAnalysis: async () => {
    set({ isAnalyzing: true });
    const { orbitalElements, telemetrySegments, windowTables } = get();
    const { events, alerts } = analyzeOcclusion({
      orbitalElements,
      telemetrySegments,
      windowTables,
    });

    await putBatchToStore("occlusion_events", events);
    await putBatchToStore("missing_frame_alerts", alerts);

    set({
      occlusionEvents: events,
      missingFrameAlerts: alerts,
      isAnalyzing: false,
    });
  },

  confirmEvent: async (eventId, reviewer) => {
    const event = get().occlusionEvents.find((e) => e.id === eventId);
    if (!event) return;

    const updated = { ...event, status: "confirmed" as const };
    await putToStore("occlusion_events", updated);

    const record: ReviewRecord = {
      id: generateId(),
      occlusionEventId: eventId,
      status: "confirmed",
      originalValue: JSON.stringify({ status: event.status }),
      correctedValue: JSON.stringify({ status: "confirmed" }),
      reviewer,
      reviewedAt: Date.now(),
    };
    await putToStore("review_records", record);

    const historyEntry: ReviewHistory = {
      id: generateId(),
      reviewRecordId: record.id,
      field: "status",
      oldValue: event.status,
      newValue: "confirmed",
      operator: reviewer,
      modifiedAt: Date.now(),
    };
    await putToStore("review_history", historyEntry);

    set((s) => ({
      occlusionEvents: s.occlusionEvents.map((e) =>
        e.id === eventId ? updated : e
      ),
      reviewRecords: [...s.reviewRecords, record],
      reviewHistory: [...s.reviewHistory, historyEntry],
    }));
  },

  modifyEvent: async (eventId, corrections, reviewer) => {
    const event = get().occlusionEvents.find((e) => e.id === eventId);
    if (!event) return;

    const updated = { ...event, status: "modified" as const };
    await putToStore("occlusion_events", updated);

    const record: ReviewRecord = {
      id: generateId(),
      occlusionEventId: eventId,
      status: "modified",
      originalValue: JSON.stringify({ status: event.status }),
      correctedValue: JSON.stringify({ status: "modified" }),
      reviewer,
      reviewedAt: Date.now(),
    };
    await putToStore("review_records", record);

    const historyEntries: ReviewHistory[] = corrections.map((c) => ({
      id: generateId(),
      reviewRecordId: record.id,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      operator: reviewer,
      modifiedAt: Date.now(),
    }));
    for (const h of historyEntries) {
      await putToStore("review_history", h);
    }

    set((s) => ({
      occlusionEvents: s.occlusionEvents.map((e) =>
        e.id === eventId ? updated : e
      ),
      reviewRecords: [...s.reviewRecords, record],
      reviewHistory: [...s.reviewHistory, ...historyEntries],
    }));
  },

  markPending: async (eventId, reviewer) => {
    const event = get().occlusionEvents.find((e) => e.id === eventId);
    if (!event) return;

    const record: ReviewRecord = {
      id: generateId(),
      occlusionEventId: eventId,
      status: "pending",
      originalValue: JSON.stringify({ status: event.status }),
      correctedValue: JSON.stringify({ status: "pending" }),
      reviewer,
      reviewedAt: Date.now(),
    };
    await putToStore("review_records", record);

    set((s) => ({
      reviewRecords: [...s.reviewRecords, record],
    }));
  },

  setSelectedEventId: (id) => set({ selectedEventId: id }),
  setTimeRange: (range) => set({ timeRange: range }),
}));
