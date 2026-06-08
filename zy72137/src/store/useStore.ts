import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SampleRecord, DiffLogEntry, FilterState } from "@/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface AppStore {
  records: SampleRecord[];
  diffLog: DiffLogEntry[];
  filter: FilterState;
  diffLogOpen: boolean;

  setRecords: (records: SampleRecord[]) => void;
  addRecords: (newRecords: SampleRecord[], duplicateGroupMap?: Map<string, string>) => void;
  updateNote: (id: string, note: string) => void;
  updateStatus: (id: string, status: SampleRecord["authorizationStatus"]) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  toggleDiffLog: () => void;
  clearAll: () => void;
}

const defaultFilter: FilterState = {
  authorizationStatus: [],
  issueTypes: [],
  dateRange: { start: null, end: null },
  keyword: "",
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      records: [],
      diffLog: [],
      filter: { ...defaultFilter },
      diffLogOpen: false,

      setRecords: (records) => {
        const diffEntries: DiffLogEntry[] = records.map((r) => ({
          id: generateId(),
          operationType: "import" as const,
          targetRecordId: r.id,
          description: `导入: ${r.originalFileName} → ${r.trackName}`,
          beforeValue: null,
          afterValue: "新增记录",
          timestamp: new Date().toISOString(),
        }));
        set({ records, diffLog: [...diffEntries, ...get().diffLog] });
      },

      addRecords: (newRecords, duplicateGroupMap) => {
        const state = get();
        const existingIds = new Set(state.records.map((r) => r.originalFileName + r.sourcePath));
        const trulyNew = newRecords.filter(
          (r) => !existingIds.has(r.originalFileName + r.sourcePath)
        );

        if (trulyNew.length === 0) return;

        let existingUpdated = state.records;
        const diffExtras: DiffLogEntry[] = [];

        if (duplicateGroupMap && duplicateGroupMap.size > 0) {
          existingUpdated = state.records.map((r) => {
            const key = r.trackName.toLowerCase();
            const groupId = duplicateGroupMap.get(key);
            if (groupId && !r.isDuplicate) {
              diffExtras.push({
                id: generateId(),
                operationType: "merge",
                targetRecordId: r.id,
                description: `重复标记: ${r.trackName} 归入组 ${groupId}`,
                beforeValue: "独立",
                afterValue: `重复组 ${groupId}`,
                timestamp: new Date().toISOString(),
              });
              return { ...r, isDuplicate: true, duplicateGroupId: groupId, updatedAt: new Date().toISOString() };
            }
            return r;
          });
        }

        const diffEntries: DiffLogEntry[] = trulyNew.map((r) => ({
          id: generateId(),
          operationType: "import" as const,
          targetRecordId: r.id,
          description: `导入: ${r.originalFileName} → ${r.trackName}`,
          beforeValue: null,
          afterValue: "新增记录",
          timestamp: new Date().toISOString(),
        }));

        set({
          records: [...existingUpdated, ...trulyNew],
          diffLog: [...diffEntries, ...diffExtras, ...state.diffLog],
        });
      },

      updateNote: (id, note) => {
        const state = get();
        const record = state.records.find((r) => r.id === id);
        if (!record) return;

        const prev = record.userNote;
        const updated = state.records.map((r) =>
          r.id === id ? { ...r, userNote: note, updatedAt: new Date().toISOString() } : r
        );

        const diffEntry: DiffLogEntry = {
          id: generateId(),
          operationType: "note_edit",
          targetRecordId: id,
          description: `备注变更: ${record.trackName}`,
          beforeValue: prev || "(空)",
          afterValue: note || "(空)",
          timestamp: new Date().toISOString(),
        };

        set({
          records: updated,
          diffLog: [diffEntry, ...state.diffLog],
        });
      },

      updateStatus: (id, status) => {
        const state = get();
        const record = state.records.find((r) => r.id === id);
        if (!record) return;

        const prev = record.authorizationStatus;
        const updated = state.records.map((r) =>
          r.id === id
            ? { ...r, authorizationStatus: status, updatedAt: new Date().toISOString() }
            : r
        );

        const diffEntry: DiffLogEntry = {
          id: generateId(),
          operationType: "status_change",
          targetRecordId: id,
          description: `状态变更: ${record.trackName}`,
          beforeValue: prev,
          afterValue: status,
          timestamp: new Date().toISOString(),
        };

        set({
          records: updated,
          diffLog: [diffEntry, ...state.diffLog],
        });
      },

      setFilter: (partial) => {
        const state = get();
        set({ filter: { ...state.filter, ...partial } });
      },

      resetFilter: () => set({ filter: { ...defaultFilter } }),

      toggleDiffLog: () => set((s) => ({ diffLogOpen: !s.diffLogOpen })),

      clearAll: () => set({ records: [], diffLog: [], filter: { ...defaultFilter } }),
    }),
    {
      name: "sample-auth-store",
      partialize: (state) => ({
        records: state.records,
        diffLog: state.diffLog,
      }),
    }
  )
);
