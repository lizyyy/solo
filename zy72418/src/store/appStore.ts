import { create } from "zustand";
import type {
  AudioRecord,
  ConflictRecord,
  AuditLog,
  SelfCheckReport,
  ImportPreviewResult,
  OperatorRole,
} from "@shared/types";

interface User {
  name: string;
  role: OperatorRole;
}

interface AppState {
  currentUser: User;
  records: AudioRecord[];
  recordsHash: string;
  conflicts: (ConflictRecord & { record?: AudioRecord })[];
  auditLogs: AuditLog[];
  selfCheckReport: SelfCheckReport | null;
  importPreview: ImportPreviewResult | null;
  loading: boolean;
  error: string | null;

  setCurrentUser: (user: User) => void;
  setRecords: (records: AudioRecord[], hash: string) => void;
  setConflicts: (conflicts: (ConflictRecord & { record?: AudioRecord })[]) => void;
  setAuditLogs: (logs: AuditLog[]) => void;
  setSelfCheckReport: (report: SelfCheckReport | null) => void;
  setImportPreview: (preview: ImportPreviewResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: { name: "阿梅", role: "coordinator" },
  records: [],
  recordsHash: "",
  conflicts: [],
  auditLogs: [],
  selfCheckReport: null,
  importPreview: null,
  loading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  setRecords: (records, hash) => set({ records, recordsHash: hash }),
  setConflicts: (conflicts) => set({ conflicts }),
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  setSelfCheckReport: (selfCheckReport) => set({ selfCheckReport }),
  setImportPreview: (importPreview) => set({ importPreview }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
