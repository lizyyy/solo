import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import type {
  User,
  Record,
  HistoryEntry,
  RecordStatus,
  HistoryAction,
  CalibrationEntry,
  ConsistencyIssue,
} from "@/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getCurrentTime(): string {
  return new Date().toISOString();
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function findChangedFields(before: Record, after: Record): string[] {
  const changed: string[] = [];
  const keys = Object.keys(before) as (keyof Record)[];
  for (const key of keys) {
    if (key === "updatedAt") continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export interface AppState {
  currentUserId: string | null;
  users: User[];
  records: Record[];
  history: HistoryEntry[];

  setCurrentUser: (userId: string) => void;
  addUser: (name: string, role: User["role"]) => User;
  getCurrentUser: () => User | undefined;

  addRecord: (
    record: Omit<Record, "id" | "status" | "pendingReason" | "createdAt" | "updatedAt">,
    source: Record["source"],
    pendingReason: string
  ) => Record;
  addRecordsBatch: (
    records: Omit<Record, "id" | "status" | "pendingReason" | "createdAt" | "updatedAt">[],
    source: Record["source"],
    pendingReason: string
  ) => Record[];
  updateRecordStatus: (
    recordId: string,
    status: RecordStatus,
    reason: string,
    rejectReason?: string
  ) => void;
  updateRecord: (recordId: string, updates: Partial<Record>, action: HistoryAction, reason: string) => void;
  updateCalibrationTable: (
    recordId: string,
    calibrationTable: CalibrationEntry[],
    reason: string
  ) => void;
  getRecordById: (id: string) => Record | undefined;

  getHistoryByRecordId: (recordId: string) => HistoryEntry[];
  filterHistory: (filters?: {
    recordId?: string;
    operatorId?: string;
    startDate?: string;
    endDate?: string;
    action?: HistoryAction;
  }) => HistoryEntry[];

  checkConsistency: () => ConsistencyIssue[];
  getExportableRecords: () => Record[];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      users: [],
      records: [],
      history: [],

      setCurrentUser: (userId: string) => {
        set({ currentUserId: userId });
      },

      addUser: (name: string, role: User["role"]) => {
        const user: User = {
          id: generateId(),
          name,
          role,
          createdAt: getCurrentTime(),
        };
        set(
          produce((state: AppState) => {
            state.users.push(user);
          })
        );
        return user;
      },

      getCurrentUser: () => {
        const state = get();
        return state.users.find((u) => u.id === state.currentUserId);
      },

      addRecord: (recordData, source, pendingReason) => {
        const state = get();
        const operatorId = state.currentUserId!;
        const now = getCurrentTime();
        const record: Record = {
          ...recordData,
          id: generateId(),
          source,
          status: "pending",
          pendingReason,
          calibrationTable: recordData.calibrationTable.map((entry) => ({
            ...entry,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        };
        const before: Record = deepClone(record);
        const after: Record = deepClone(record);
        const historyEntry: HistoryEntry = {
          id: generateId(),
          recordId: record.id,
          operatorId,
          action: "create",
          reason: pendingReason,
          before,
          after,
          changedFields: [],
          createdAt: now,
        };
        set(
          produce((state: AppState) => {
            state.records.push(record);
            state.history.push(historyEntry);
          })
        );
        return record;
      },

      addRecordsBatch: (recordsData, source, pendingReason) => {
        const state = get();
        const operatorId = state.currentUserId!;
        const now = getCurrentTime();
        const newRecords: Record[] = [];
        const newHistory: HistoryEntry[] = [];
        for (const recordData of recordsData) {
          const record: Record = {
            ...recordData,
            id: generateId(),
            source,
            status: "pending",
            pendingReason,
            calibrationTable: recordData.calibrationTable.map((entry) => ({
              ...entry,
              id: generateId(),
              createdAt: now,
              updatedAt: now,
            })),
            createdAt: now,
            updatedAt: now,
          };
          const before: Record = deepClone(record);
          const after: Record = deepClone(record);
          const historyEntry: HistoryEntry = {
            id: generateId(),
            recordId: record.id,
            operatorId,
            action: "create",
            reason: pendingReason,
            before,
            after,
            changedFields: [],
            createdAt: now,
          };
          newRecords.push(record);
          newHistory.push(historyEntry);
        }
        set(
          produce((state: AppState) => {
            state.records.push(...newRecords);
            state.history.push(...newHistory);
          })
        );
        return newRecords;
      },

      updateRecordStatus: (recordId, status, reason, rejectReason) => {
        const state = get();
        const operatorId = state.currentUserId!;
        const now = getCurrentTime();
        const record = state.records.find((r) => r.id === recordId);
        if (!record) return;
        const before: Record = deepClone(record);
        const action: HistoryAction =
          status === "reviewed" ? "review_approve" : "review_reject";
        set(
          produce((state: AppState) => {
            const r = state.records.find((rec) => rec.id === recordId);
            if (r) {
              r.status = status;
              r.reviewerId = operatorId;
              r.updatedAt = now;
              if (rejectReason) {
                r.rejectReason = rejectReason;
              }
            }
          })
        );
        const afterRecord = state.records.find((r) => r.id === recordId)!;
        const after: Record = deepClone(afterRecord);
        const changedFields = findChangedFields(before, after);
        const historyEntry: HistoryEntry = {
          id: generateId(),
          recordId,
          operatorId,
          action,
          reason,
          before,
          after,
          changedFields,
          createdAt: now,
        };
        set(
          produce((state: AppState) => {
            state.history.push(historyEntry);
          })
        );
      },

      updateRecord: (recordId, updates, action, reason) => {
        const state = get();
        const operatorId = state.currentUserId!;
        const now = getCurrentTime();
        const record = state.records.find((r) => r.id === recordId);
        if (!record) return;
        const before: Record = deepClone(record);
        set(
          produce((state: AppState) => {
            const r = state.records.find((rec) => rec.id === recordId);
            if (r) {
              Object.assign(r, updates);
              r.updatedAt = now;
            }
          })
        );
        const afterRecord = state.records.find((r) => r.id === recordId)!;
        const after: Record = deepClone(afterRecord);
        const changedFields = findChangedFields(before, after);
        const historyEntry: HistoryEntry = {
          id: generateId(),
          recordId,
          operatorId,
          action,
          reason,
          before,
          after,
          changedFields,
          createdAt: now,
        };
        set(
          produce((state: AppState) => {
            state.history.push(historyEntry);
          })
        );
      },

      updateCalibrationTable: (recordId, calibrationTable, reason) => {
        const state = get();
        const operatorId = state.currentUserId!;
        const now = getCurrentTime();
        const record = state.records.find((r) => r.id === recordId);
        if (!record) return;
        const before: Record = deepClone(record);
        const totalError = calibrationTable.reduce((sum, e) => sum + e.error, 0);
        set(
          produce((state: AppState) => {
            const r = state.records.find((rec) => rec.id === recordId);
            if (r) {
              r.calibrationTable = calibrationTable.map((entry) => ({
                ...entry,
                id: entry.id || generateId(),
                updatedAt: now,
                createdAt: entry.createdAt || now,
              }));
              r.error = totalError;
              r.updatedAt = now;
            }
          })
        );
        const afterRecord = state.records.find((r) => r.id === recordId)!;
        const after: Record = deepClone(afterRecord);
        const changedFields = findChangedFields(before, after);
        const historyEntry: HistoryEntry = {
          id: generateId(),
          recordId,
          operatorId,
          action: "calibration_correct",
          reason,
          before,
          after,
          changedFields,
          createdAt: now,
        };
        set(
          produce((state: AppState) => {
            state.history.push(historyEntry);
          })
        );
      },

      getRecordById: (id) => {
        return get().records.find((r) => r.id === id);
      },

      getHistoryByRecordId: (recordId) => {
        return get().history.filter((h) => h.recordId === recordId).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      filterHistory: (filters) => {
        let result = [...get().history];
        if (filters?.recordId) {
          result = result.filter((h) => h.recordId === filters.recordId);
        }
        if (filters?.operatorId) {
          result = result.filter((h) => h.operatorId === filters.operatorId);
        }
        if (filters?.startDate) {
          result = result.filter((h) => h.createdAt >= filters.startDate!);
        }
        if (filters?.endDate) {
          result = result.filter((h) => h.createdAt <= filters.endDate!);
        }
        if (filters?.action) {
          result = result.filter((h) => h.action === filters.action);
        }
        return result.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      checkConsistency: () => {
        const issues: ConsistencyIssue[] = [];
        const records = get().records;
        for (const record of records) {
          const calSum = record.calibrationTable.reduce(
            (sum, e) => sum + e.error,
            0
          );
          if (Math.abs(calSum - record.error) > 0.001) {
            issues.push({
              recordId: record.id,
              recordName: record.experimentName,
              severity: "error",
              message: `标定表误差之和（${calSum.toFixed(3)}mm）与记录总误差（${record.error.toFixed(3)}mm）不一致`,
              field: "error",
            });
          }
          if (record.status === "rejected") {
            issues.push({
              recordId: record.id,
              recordName: record.experimentName,
              severity: "error",
              message: "记录已被驳回，不允许导出",
              field: "status",
            });
          }
          if (record.status === "pending") {
            issues.push({
              recordId: record.id,
              recordName: record.experimentName,
              severity: "warning",
              message: "记录尚未复核",
              field: "status",
            });
          }
          if (!record.reviewerId && record.status !== "rejected") {
            issues.push({
              recordId: record.id,
              recordName: record.experimentName,
              severity: "warning",
              message: "缺少复核人信息",
              field: "reviewerId",
            });
          }
        }
        return issues;
      },

      getExportableRecords: () => {
        return get().records.filter((r) => r.status === "reviewed");
      },
    }),
    {
      name: "lens-imaging-error-store",
      version: 1,
    }
  )
);
