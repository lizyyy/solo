import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CompensationEvent,
  StatusChange,
  AuditLog,
  FilterState,
  ImportRecord,
  DiffItem,
  EventStatus,
} from "@/types";
import { PENDING_CONFIRM_STATUSES, TERMINAL_STATUSES } from "@/types";
import { generateMockData } from "@/utils/mockData";
import { computeImportDiff } from "@/utils/exportHelpers";

interface QueueStore {
  events: CompensationEvent[];
  statusChanges: StatusChange[];
  auditLogs: AuditLog[];
  importRecords: ImportRecord[];
  filter: FilterState;
  selectedEventIds: string[];

  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  toggleEventSelection: (id: string) => void;
  selectAllFiltered: (ids: string[]) => void;
  clearSelection: () => void;

  getFilteredEvents: () => CompensationEvent[];
  getEventById: (id: string) => CompensationEvent | undefined;
  getStatusChanges: (eventId: string) => StatusChange[];
  getAuditLogs: (eventId: string) => AuditLog[];

  confirmEvent: (id: string, result: "success" | "failed", operator: string) => void;
  revokeEvent: (id: string, reason: string, operator: string) => void;
  batchConfirm: (ids: string[], result: "success" | "failed", operator: string) => void;

  importEvents: (
    newEvents: CompensationEvent[],
    _fileName: string,
    _version: string
  ) => { diffs: DiffItem[]; existingVersion: string | null };
  applyImport: (diffs: DiffItem[], newEvents: CompensationEvent[], fileName: string, version: string) => void;

  initMockData: () => void;
}

const defaultFilter: FilterState = {
  statuses: [],
  exceptionTypes: [],
  clientId: "",
  idempotencyKeySearch: "",
  timeRangeStart: null,
  timeRangeEnd: null,
};

export const useQueueStore = create<QueueStore>()(
  persist(
    (set, get) => ({
      events: [],
      statusChanges: [],
      auditLogs: [],
      importRecords: [],
      filter: { ...defaultFilter },
      selectedEventIds: [],

      setFilter: (partial) =>
        set((state) => ({
          filter: { ...state.filter, ...partial },
          selectedEventIds: [],
        })),

      resetFilter: () =>
        set({ filter: { ...defaultFilter }, selectedEventIds: [] }),

      toggleEventSelection: (id) =>
        set((state) => {
          const sel = new Set(state.selectedEventIds);
          if (sel.has(id)) sel.delete(id);
          else sel.add(id);
          return { selectedEventIds: [...sel] };
        }),

      selectAllFiltered: (ids) => set({ selectedEventIds: ids }),

      clearSelection: () => set({ selectedEventIds: [] }),

      getFilteredEvents: () => {
        const { events, filter } = get();
        return events.filter((e) => {
          if (filter.statuses.length > 0 && !filter.statuses.includes(e.status))
            return false;
          if (
            filter.exceptionTypes.length > 0 &&
            !filter.exceptionTypes.includes(e.exceptionType)
          )
            return false;
          if (filter.clientId && e.clientId !== filter.clientId) return false;
          if (
            filter.idempotencyKeySearch &&
            !e.idempotencyKey
              .toLowerCase()
              .includes(filter.idempotencyKeySearch.toLowerCase())
          )
            return false;
          if (filter.timeRangeStart && e.createdAt < filter.timeRangeStart)
            return false;
          if (filter.timeRangeEnd && e.createdAt > filter.timeRangeEnd)
            return false;
          return true;
        });
      },

      getEventById: (id) => get().events.find((e) => e.id === id),

      getStatusChanges: (eventId) =>
        get().statusChanges.filter((sc) => sc.eventId === eventId),

      getAuditLogs: (eventId) =>
        get().auditLogs.filter((log) => log.eventId === eventId),

      confirmEvent: (id, result, operator) =>
        set((state) => {
          const event = state.events.find((e) => e.id === id);
          if (!event) return state;
          if (!PENDING_CONFIRM_STATUSES.includes(event.status) && !TERMINAL_STATUSES.includes(event.status))
            return state;

          const now = Date.now();
          const scId = `sc_${state.statusChanges.length.toString().padStart(4, "0")}`;
          const logId = `log_${state.auditLogs.length.toString().padStart(4, "0")}`;

          return {
            events: state.events.map((e) =>
              e.id === id
                ? {
                    ...e,
                    status: result,
                    exceptionType: "none" as const,
                    updatedAt: now,
                  }
                : e
            ),
            statusChanges: [
              ...state.statusChanges,
              {
                id: scId,
                eventId: id,
                fromStatus: event.status,
                toStatus: result,
                reason:
                  result === "success"
                    ? "人工确认：结果有效"
                    : "人工确认：结果无效",
                operator,
                timestamp: now,
              },
            ],
            auditLogs: [
              ...state.auditLogs,
              {
                id: logId,
                eventId: id,
                action: "confirmed",
                detail: `人工确认事件为${result === "success" ? "成功" : "失败"}，原状态=${event.status}`,
                operator,
                timestamp: now,
              },
            ],
            selectedEventIds: state.selectedEventIds.filter((sid) => sid !== id),
          };
        }),

      revokeEvent: (id, reason, operator) =>
        set((state) => {
          const event = state.events.find((e) => e.id === id);
          if (!event) return state;
          if (event.status === "pending" || event.status === "processing")
            return state;

          const now = Date.now();
          const scId = `sc_${state.statusChanges.length.toString().padStart(4, "0")}`;
          const logId = `log_${state.auditLogs.length.toString().padStart(4, "0")}`;

          return {
            events: state.events.map((e) =>
              e.id === id
                ? { ...e, status: "pending" as EventStatus, updatedAt: now }
                : e
            ),
            statusChanges: [
              ...state.statusChanges,
              {
                id: scId,
                eventId: id,
                fromStatus: event.status,
                toStatus: "pending",
                reason: `撤回修正：${reason}`,
                operator,
                timestamp: now,
              },
            ],
            auditLogs: [
              ...state.auditLogs,
              {
                id: logId,
                eventId: id,
                action: "revoked",
                detail: `撤回事件，原状态=${event.status}，原因=${reason}`,
                operator,
                timestamp: now,
              },
            ],
            selectedEventIds: state.selectedEventIds.filter((sid) => sid !== id),
          };
        }),

      batchConfirm: (ids, result, operator) => {
        for (const id of ids) {
          get().confirmEvent(id, result, operator);
        }
      },

      importEvents: (newEvents, fileName, version) => {
        const { events } = get();
        const diffs = computeImportDiff(newEvents, events);
        const existingVersion =
          events.length > 0 ? events[0].version : null;
        return { diffs, existingVersion };
      },

      applyImport: (diffs, newEvents, fileName, version) =>
        set((state) => {
          const now = Date.now();
          const existingMap = new Map(
            state.events.map((e) => [e.idempotencyKey, e])
          );
          const importedMap = new Map(
            newEvents.map((e) => [e.idempotencyKey, e])
          );

          const updatedEvents = [...state.events];
          const newStatusChanges: StatusChange[] = [];
          const newAuditLogs: AuditLog[] = [];

          for (const diff of diffs) {
            if (diff.type === "added") {
              const newEvt = importedMap.get(diff.idempotencyKey);
              if (newEvt) {
                updatedEvents.push({ ...newEvt, version: newEvt.version || "1.0" });
                newStatusChanges.push({
                  id: `sc_${(state.statusChanges.length + newStatusChanges.length).toString().padStart(4, "0")}`,
                  eventId: newEvt.id,
                  fromStatus: "",
                  toStatus: "pending",
                  reason: "导入新增",
                  operator: "import",
                  timestamp: now,
                });
              }
            } else if (diff.type === "modified") {
              const newEvt = importedMap.get(diff.idempotencyKey);
              if (newEvt) {
                const idx = updatedEvents.findIndex(
                  (e) => e.idempotencyKey === diff.idempotencyKey
                );
                if (idx !== -1) {
                  const oldEvt = updatedEvents[idx];
                  newAuditLogs.push({
                    id: `log_${(state.auditLogs.length + newAuditLogs.length).toString().padStart(4, "0")}`,
                    eventId: oldEvt.id,
                    action: "import_modified",
                    detail: `导入覆盖，变更字段：${diff.field || "未知"}`,
                    operator: "import",
                    timestamp: now,
                  });
                  updatedEvents[idx] = {
                    ...oldEvt,
                    payload: newEvt.payload,
                    version: newEvt.version,
                    updatedAt: now,
                  };
                }
              }
            }
          }

          const importRecord: ImportRecord = {
            id: `imp_${state.importRecords.length.toString().padStart(4, "0")}`,
            fileName,
            version,
            importTime: now,
            checksum: "",
            diffSummary: {
              added: diffs.filter((d) => d.type === "added").length,
              modified: diffs.filter((d) => d.type === "modified").length,
              removed: diffs.filter((d) => d.type === "removed").length,
              details: diffs,
            },
          };

          return {
            events: updatedEvents,
            statusChanges: [...state.statusChanges, ...newStatusChanges],
            auditLogs: [...state.auditLogs, ...newAuditLogs],
            importRecords: [...state.importRecords, importRecord],
          };
        }),

      initMockData: () => {
        const { events, statusChanges, auditLogs } = generateMockData();
        set({
          events,
          statusChanges,
          auditLogs,
          importRecords: [],
          filter: { ...defaultFilter },
          selectedEventIds: [],
        });
      },
    }),
    {
      name: "webhook-compensation-queue",
      partialize: (state) => ({
        events: state.events,
        statusChanges: state.statusChanges,
        auditLogs: state.auditLogs,
        importRecords: state.importRecords,
      }),
    }
  )
);
