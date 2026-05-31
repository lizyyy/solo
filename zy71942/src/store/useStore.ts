import { create } from "zustand";
import type {
  PayloadPlan,
  GroundStationSchedule,
  ConflictItem,
  ConflictStatus,
  VersionDiff,
  ImportHistoryEntry,
  FilterState,
} from "@/types";
import { detectConflicts } from "@/engine/conflictDetector";
import { computeVersionDiff } from "@/engine/versionDiff";
import { lsGet, lsSet } from "@/utils/persistence";
import { idbPut, idbGetAll } from "@/utils/persistence";
import { parseImportFile } from "@/utils/csvParser";

interface AppState {
  plans: PayloadPlan[];
  schedules: GroundStationSchedule[];
  conflicts: ConflictItem[];
  versionDiffs: VersionDiff[];
  importHistory: ImportHistoryEntry[];
  filters: FilterState;
  duplicateAlert: {
    visible: boolean;
    existingName: string;
    existingVersion: string;
    pendingData: string;
  } | null;
  changeAlerts: { id: string; message: string; diffId: string }[];

  importPayloadPlan: (
    text: string,
    filename: string,
    operator: string
  ) => void;
  importGroundStationSchedule: (
    text: string,
    filename: string,
    operator: string
  ) => void;
  confirmDuplicate: (action: "keep" | "overwrite") => void;
  dismissDuplicateAlert: () => void;
  retractImport: (historyId: string) => void;
  updateConflictStatus: (
    conflictId: string,
    status: ConflictStatus
  ) => void;
  retractConflict: (conflictId: string) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  dismissChangeAlert: (id: string) => void;
  loadPersistedData: () => Promise<void>;
}

const DEFAULT_FILTERS: FilterState = {
  conflictTypes: [],
  statuses: [],
  stationName: "",
  timeRangeStart: "",
  timeRangeEnd: "",
};

function persistState(state: {
  plans: PayloadPlan[];
  schedules: GroundStationSchedule[];
  conflicts: ConflictItem[];
  versionDiffs: VersionDiff[];
  importHistory: ImportHistoryEntry[];
  filters: FilterState;
}) {
  lsSet("plans", state.plans);
  lsSet("schedules", state.schedules);
  lsSet("conflicts", state.conflicts);
  lsSet("versionDiffs", state.versionDiffs);
  lsSet("importHistory", state.importHistory);
  lsSet("filters", state.filters);
}

function reRunDetection(
  plans: PayloadPlan[],
  schedules: GroundStationSchedule[]
): ConflictItem[] {
  return detectConflicts(plans, schedules);
}

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  schedules: [],
  conflicts: [],
  versionDiffs: [],
  importHistory: [],
  filters: { ...DEFAULT_FILTERS },
  duplicateAlert: null,
  changeAlerts: [],

  importPayloadPlan(text, filename, operator) {
    const { windows, telemetrySegments } = parseImportFile(text, filename);
    const { plans, schedules, importHistory } = get();

    const planName = filename.replace(/\.(json|csv)$/i, "");
    const existing = plans.find((p) => p.name === planName);

    if (existing) {
      set({
        duplicateAlert: {
          visible: true,
          existingName: existing.name,
          existingVersion: existing.version,
          pendingData: text,
        },
      });
      return;
    }

    const newPlan: PayloadPlan = {
      id: crypto.randomUUID(),
      name: planName,
      version: "1.0",
      importedAt: new Date().toISOString(),
      operator,
      windows,
      telemetrySegments,
    };

    const snapshot = JSON.stringify({
      plans,
      schedules,
      conflicts: get().conflicts,
      versionDiffs: get().versionDiffs,
    });

    const newPlans = [...plans, newPlan];
    const newConflicts = reRunDetection(newPlans, schedules);

    const historyEntry: ImportHistoryEntry = {
      id: crypto.randomUUID(),
      type: "payload_plan",
      filename,
      operator,
      importedAt: new Date().toISOString(),
      name: planName,
      retracted: false,
      snapshot,
    };

    const newHistory = [...importHistory, historyEntry];

    idbPut({ id: newPlan.id, ...newPlan });

    const nextState = {
      plans: newPlans,
      conflicts: newConflicts,
      importHistory: newHistory,
    };

    persistState({ ...nextState, schedules, versionDiffs: get().versionDiffs, filters: get().filters });
    set(nextState);
  },

  importGroundStationSchedule(text, filename, operator) {
    const { windows } = parseImportFile(text, filename);
    const { plans, schedules, importHistory } = get();

    const scheduleName = filename.replace(/\.(json|csv)$/i, "");
    const existing = schedules.find((s) => s.name === scheduleName);

    if (existing) {
      set({
        duplicateAlert: {
          visible: true,
          existingName: existing.name,
          existingVersion: "",
          pendingData: text,
        },
      });
      return;
    }

    const newSchedule: GroundStationSchedule = {
      id: crypto.randomUUID(),
      name: scheduleName,
      importedAt: new Date().toISOString(),
      operator,
      windows,
    };

    const snapshot = JSON.stringify({
      plans,
      schedules,
      conflicts: get().conflicts,
      versionDiffs: get().versionDiffs,
    });

    const newSchedules = [...schedules, newSchedule];
    const newConflicts = reRunDetection(plans, newSchedules);

    const historyEntry: ImportHistoryEntry = {
      id: crypto.randomUUID(),
      type: "ground_station_schedule",
      filename,
      operator,
      importedAt: new Date().toISOString(),
      name: scheduleName,
      retracted: false,
      snapshot,
    };

    const newHistory = [...importHistory, historyEntry];

    const nextState = {
      schedules: newSchedules,
      conflicts: newConflicts,
      importHistory: newHistory,
    };

    persistState({ ...nextState, plans, versionDiffs: get().versionDiffs, filters: get().filters });
    set(nextState);
  },

  confirmDuplicate(action) {
    if (action === "keep") {
      set({ duplicateAlert: null });
      return;
    }

    const { duplicateAlert, plans, schedules } = get();
    if (!duplicateAlert) return;

    const existing = plans.find((p) => p.name === duplicateAlert.existingName);
    if (!existing) {
      set({ duplicateAlert: null });
      return;
    }

    const { windows, telemetrySegments } = parseImportFile(
      duplicateAlert.pendingData,
      duplicateAlert.existingName
    );

    const oldPlan = { ...existing };

    const newVersion = incrementVersion(existing.version);
    const updatedPlan: PayloadPlan = {
      ...existing,
      version: newVersion,
      windows,
      telemetrySegments,
      importedAt: new Date().toISOString(),
    };

    const affectedConflictIds = get()
      .conflicts.filter((c) => c.payloadPlanId === existing.id)
      .map((c) => c.id);

    const diff = computeVersionDiff(oldPlan, updatedPlan, affectedConflictIds);

    const newPlans = plans.map((p) =>
      p.id === existing.id ? updatedPlan : p
    );

    const reDetected = reRunDetection(newPlans, schedules);

    const newVersionDiffs = [...get().versionDiffs, diff];

    const alertId = crypto.randomUUID();
    const newChangeAlerts = [
      ...get().changeAlerts,
      {
        id: alertId,
        message: `载荷计划「${existing.name}」版本从 ${oldPlan.version} 更新为 ${newVersion}，${diff.summary}`,
        diffId: diff.id,
      },
    ];

    idbPut({ id: updatedPlan.id, ...updatedPlan });

    const nextState = {
      plans: newPlans,
      conflicts: reDetected,
      versionDiffs: newVersionDiffs,
      changeAlerts: newChangeAlerts,
      duplicateAlert: null,
    };

    persistState({
      ...nextState,
      schedules,
      importHistory: get().importHistory,
      filters: get().filters,
    });
    set(nextState);
  },

  dismissDuplicateAlert() {
    set({ duplicateAlert: null });
  },

  retractImport(historyId) {
    const { importHistory, plans, schedules } = get();
    const entry = importHistory.find((h) => h.id === historyId);
    if (!entry || entry.retracted) return;

    let snapshot: {
      plans: PayloadPlan[];
      schedules: GroundStationSchedule[];
      conflicts: ConflictItem[];
      versionDiffs: VersionDiff[];
    };

    try {
      snapshot = JSON.parse(entry.snapshot);
    } catch {
      return;
    }

    const newHistory = importHistory.map((h) =>
      h.id === historyId ? { ...h, retracted: true } : h
    );

    let newPlans = snapshot.plans;
    let newSchedules = snapshot.schedules;

    if (entry.type === "payload_plan") {
      newPlans = snapshot.plans.filter(
        (p) => !(p.name === entry.name && p.importedAt >= entry.importedAt)
      );
      newSchedules = schedules;
    } else {
      newSchedules = snapshot.schedules.filter(
        (s) => !(s.name === entry.name && s.importedAt >= entry.importedAt)
      );
      newPlans = plans;
    }

    const newConflicts = reRunDetection(newPlans, newSchedules);

    const nextState = {
      plans: newPlans,
      schedules: newSchedules,
      conflicts: newConflicts,
      importHistory: newHistory,
    };

    persistState({
      ...nextState,
      versionDiffs: get().versionDiffs,
      filters: get().filters,
    });
    set(nextState);
  },

  updateConflictStatus(conflictId, status) {
    const { conflicts, plans, schedules, versionDiffs, importHistory, filters } = get();
    const newConflicts = conflicts.map((c) =>
      c.id === conflictId ? { ...c, status } : c
    );

    persistState({
      plans,
      schedules,
      conflicts: newConflicts,
      versionDiffs,
      importHistory,
      filters,
    });
    set({ conflicts: newConflicts });
  },

  retractConflict(conflictId) {
    const { conflicts, plans, schedules, versionDiffs, importHistory, filters } = get();
    const newConflicts = conflicts.map((c) => {
      if (c.id === conflictId) {
        return {
          ...c,
          status: "pending" as ConflictStatus,
          retractedFrom: c.status,
        };
      }
      return c;
    });

    persistState({
      plans,
      schedules,
      conflicts: newConflicts,
      versionDiffs,
      importHistory,
      filters,
    });
    set({ conflicts: newConflicts });
  },

  setFilters(partial) {
    const { filters, plans, schedules, conflicts, versionDiffs, importHistory } = get();
    const newFilters = { ...filters, ...partial };

    persistState({
      plans,
      schedules,
      conflicts,
      versionDiffs,
      importHistory,
      filters: newFilters,
    });
    set({ filters: newFilters });
  },

  resetFilters() {
    const { plans, schedules, conflicts, versionDiffs, importHistory } = get();
    const newFilters = { ...DEFAULT_FILTERS };

    persistState({
      plans,
      schedules,
      conflicts,
      versionDiffs,
      importHistory,
      filters: newFilters,
    });
    set({ filters: newFilters });
  },

  dismissChangeAlert(id) {
    set((state) => ({
      changeAlerts: state.changeAlerts.filter((a) => a.id !== id),
    }));
  },

  async loadPersistedData() {
    const plans = lsGet<PayloadPlan[]>("plans", []);
    const schedules = lsGet<GroundStationSchedule[]>("schedules", []);
    const conflicts = lsGet<ConflictItem[]>("conflicts", []);
    const versionDiffs = lsGet<VersionDiff[]>("versionDiffs", []);
    const importHistory = lsGet<ImportHistoryEntry[]>("importHistory", []);
    const filters = lsGet<FilterState>("filters", { ...DEFAULT_FILTERS });

    const allDocs = await idbGetAll();
    const versionSnapshots = new Map<string, unknown>();
    for (const doc of allDocs) {
      const d = doc as { id: string; [k: string]: unknown };
      versionSnapshots.set(d.id, d);
    }

    for (const plan of plans) {
      const snap = versionSnapshots.get(plan.id);
      if (snap) {
        const s = snap as Record<string, unknown>;
        plan.windows = (s.windows as PayloadPlan["windows"]) || plan.windows;
        plan.telemetrySegments =
          (s.telemetrySegments as PayloadPlan["telemetrySegments"]) ||
          plan.telemetrySegments;
      }
    }

    set({ plans, schedules, conflicts, versionDiffs, importHistory, filters });
  },
}));

function incrementVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length === 0) return "2.0";
  const last = parseInt(parts[parts.length - 1], 10);
  if (isNaN(last)) return version + ".1";
  parts[parts.length - 1] = String(last + 1);
  return parts.join(".");
}
