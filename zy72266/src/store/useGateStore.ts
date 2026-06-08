import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  SafetyRadiusRecord,
  AuditLog,
  ZAxisDetectionResult,
  RollbackSnapshot,
  RecordStatus,
  AuditAction,
  OperatorRole,
} from "@/types";
import { applyZAxisDetection, createDetectionResult } from "@/services/zAxisDetection";
import {
  validateTransition,
  getNextStatus,
  createAuditLog,
  createRollbackSnapshot,
} from "@/services/stateMachine";

interface GateStore {
  records: SafetyRadiusRecord[];
  auditLogs: AuditLog[];
  detections: ZAxisDetectionResult[];
  rollbackSnapshots: RollbackSnapshot[];
  currentUser: { name: string; role: OperatorRole } | null;

  importRecords: (rows: Omit<SafetyRadiusRecord, "id" | "status" | "createdAt" | "updatedAt" | "zAxisDirection">[]) => void;
  transitionRecord: (recordId: string, action: AuditAction, detail: string) => boolean;
  rollbackRecord: (recordId: string, reason: string) => boolean;
  manualCorrectZAxis: (recordId: string) => boolean;
  getRecordById: (id: string) => SafetyRadiusRecord | undefined;
  getAuditLogsForRecord: (recordId: string) => AuditLog[];
  getDetectionsForRecord: (recordId: string) => ZAxisDetectionResult | undefined;
  getRecordsByStatus: (status: RecordStatus) => SafetyRadiusRecord[];
  getAllRecords: () => SafetyRadiusRecord[];
  getAllAuditLogs: () => AuditLog[];
  login: (name: string, role: OperatorRole) => void;
  logout: () => void;
  resetStore: () => void;
}

export const useGateStore = create<GateStore>()(
  persist(
    (set, get) => ({
      records: [],
      auditLogs: [],
      detections: [],
      rollbackSnapshots: [],
      currentUser: null,

      importRecords: (rows) => {
        const now = new Date().toISOString();
        const newRecords: SafetyRadiusRecord[] = [];
        const newDetections: ZAxisDetectionResult[] = [];
        const newLogs: AuditLog[] = [];
        const currentUser = get().currentUser;

        rows.forEach((row, idx) => {
          const id = `rec-${Date.now()}-${idx}`;
          const rawRecord: SafetyRadiusRecord = {
            ...row,
            id,
            zAxisDirection: "positive",
            status: "pending_review",
            createdAt: now,
            updatedAt: now,
          };
          const { record, detection } = applyZAxisDetection(rawRecord);

          if (detection.ruleCode === "ZR-001" || detection.ruleCode === "ZR-003") {
            record.status = "pending_review";
          }

          newRecords.push(record);
          newDetections.push(detection);
          newLogs.push(
            createAuditLog(
              id,
              "import",
              currentUser?.name ?? "系统",
              currentUser?.role ?? "instructor",
              "pending_review" as RecordStatus,
              record.status,
              `导入安全半径表第 ${row.originalRowNumber} 行` +
                (detection.ruleCode === "ZR-001"
                  ? "，Z轴方向按旧习惯写反"
                  : detection.ruleCode === "ZR-003"
                  ? "，Z轴数值缺失"
                  : "")
            )
          );
        });

        set((state) => ({
          records: [...state.records, ...newRecords],
          auditLogs: [...state.auditLogs, ...newLogs],
          detections: [...state.detections, ...newDetections],
        }));
      },

      transitionRecord: (recordId, action, detail) => {
        const state = get();
        const record = state.records.find((r) => r.id === recordId);
        if (!record) return false;

        if (!validateTransition(record.status, action)) return false;

        const newStatus = getNextStatus(record.status, action);
        if (!newStatus) return false;

        const currentUser = state.currentUser;
        const now = new Date().toISOString();

        const snapshot = createRollbackSnapshot(recordId, record.status, record);

        const log = createAuditLog(
          recordId,
          action,
          currentUser?.name ?? "系统",
          currentUser?.role ?? "instructor",
          record.status,
          newStatus,
          detail
        );

        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? { ...r, status: newStatus, updatedAt: now }
              : r
          ),
          auditLogs: [...state.auditLogs, log],
          rollbackSnapshots: [...state.rollbackSnapshots, snapshot],
        }));

        return true;
      },

      rollbackRecord: (recordId, reason) => {
        const state = get();
        const record = state.records.find((r) => r.id === recordId);
        if (!record) return false;

        const snapshots = state.rollbackSnapshots.filter(
          (s) => s.recordId === recordId
        );
        if (snapshots.length === 0) return false;

        const lastSnapshot = snapshots[snapshots.length - 1];
        const now = new Date().toISOString();
        const currentUser = state.currentUser;

        const log = createAuditLog(
          recordId,
          "rollback",
          currentUser?.name ?? "系统",
          currentUser?.role ?? "instructor",
          record.status,
          "rolled_back",
          `回滚原因: ${reason}；恢复至状态: ${lastSnapshot.previousStatus}`
        );

        const newSnapshot = createRollbackSnapshot(recordId, record.status, record);

        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  status: "rolled_back",
                  zAxisValue: lastSnapshot.snapshot.zAxisValue,
                  zAxisDirection: lastSnapshot.snapshot.zAxisDirection,
                  updatedAt: now,
                }
              : r
          ),
          auditLogs: [...state.auditLogs, log],
          rollbackSnapshots: [...state.rollbackSnapshots, newSnapshot],
        }));

        return true;
      },

      manualCorrectZAxis: (recordId) => {
        const state = get();
        const record = state.records.find((r) => r.id === recordId);
        if (!record) return false;
        if (record.status !== "pending_field_review") return false;
        if (record.zAxisValue === null) return false;

        const oldZValue = record.zAxisValue;
        const oldDirection = record.zAxisDirection;
        const newZValue = Math.abs(oldZValue);
        const now = new Date().toISOString();
        const currentUser = state.currentUser;

        const snapshot = createRollbackSnapshot(recordId, record.status, record);

        const newDetection = createDetectionResult(recordId, newZValue);

        const log = createAuditLog(
          recordId,
          "manual_correction",
          currentUser?.name ?? "系统",
          currentUser?.role ?? "field_team",
          record.status,
          "corrected",
          `人工更正Z轴: ${oldZValue} → ${newZValue}，方向: ${oldDirection} → positive`
        );

        const statusLog = createAuditLog(
          recordId,
          "field_confirm_correct",
          currentUser?.name ?? "系统",
          currentUser?.role ?? "field_team",
          record.status,
          "corrected",
          `现场班组确认第${record.originalRowNumber}行需更正Z轴方向，原值 ${oldZValue} 更正为 ${newZValue}`
        );

        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  status: "corrected" as RecordStatus,
                  zAxisValue: newZValue,
                  zAxisDirection: "positive" as const,
                  updatedAt: now,
                }
              : r
          ),
          auditLogs: [...state.auditLogs, statusLog, log],
          rollbackSnapshots: [...state.rollbackSnapshots, snapshot],
          detections: state.detections.map((d) =>
            d.recordId === recordId ? newDetection : d
          ),
        }));

        return true;
      },

      getRecordById: (id) => get().records.find((r) => r.id === id),

      getAuditLogsForRecord: (recordId) =>
        get().auditLogs.filter((l) => l.recordId === recordId),

      getDetectionsForRecord: (recordId) =>
        get().detections.find((d) => d.recordId === recordId),

      getRecordsByStatus: (status) =>
        get().records.filter((r) => r.status === status),

      getAllRecords: () => get().records,

      getAllAuditLogs: () => get().auditLogs,

      login: (name, role) => set({ currentUser: { name, role } }),

      logout: () => set({ currentUser: null }),

      resetStore: () =>
        set({
          records: [],
          auditLogs: [],
          detections: [],
          rollbackSnapshots: [],
        }),
    }),
    {
      name: "gate-opening-store",
    }
  )
);
