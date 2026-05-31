import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SunshineRecord, StatusHistory, RecordStatus } from '@/types';
import { mockRecords, mockHistories } from '@/utils/mockData';
import { generateId } from '@/utils/statusUtils';

interface RecordState {
  records: SunshineRecord[];
  histories: StatusHistory[];
  currentUser: string;
  addRecord: (record: Omit<SunshineRecord, 'id' | 'importTime' | 'lastModified'>) => void;
  updateRecordStatus: (recordId: string, newStatus: RecordStatus, reason: string, remark?: string) => void;
  updateRecord: (recordId: string, updates: Partial<SunshineRecord>) => void;
  deleteRecord: (recordId: string) => void;
  importRecords: (records: Omit<SunshineRecord, 'id' | 'importTime' | 'lastModified' | 'sourceType' | 'isManualModified' | 'status'>[]) => void;
  getRecordHistories: (recordId: string) => StatusHistory[];
  resetToMockData: () => void;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: mockRecords,
      histories: mockHistories,
      currentUser: '当前用户',

      addRecord: (recordData) => {
        const now = new Date().toISOString();
        const newRecord: SunshineRecord = {
          ...recordData,
          id: generateId(),
          importTime: now,
          lastModified: now,
        };
        set((state) => ({
          records: [...state.records, newRecord],
        }));
      },

      updateRecordStatus: (recordId, newStatus, reason, remark) => {
        const now = new Date().toISOString();
        const { currentUser } = get();
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return;

        const historyEntry: StatusHistory = {
          id: generateId(),
          recordId,
          fromStatus: record.status,
          toStatus: newStatus,
          reason,
          operator: currentUser,
          operateTime: now,
          remark,
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  status: newStatus,
                  lastModified: now,
                  lastModifier: currentUser,
                  currentHandler: currentUser,
                  pendingReason: newStatus === 'to_supplement' ? reason : undefined,
                  isManualModified: newStatus !== 'pending',
                  remark: remark || r.remark,
                }
              : r
          ),
          histories: [...state.histories, historyEntry],
        }));
      },

      updateRecord: (recordId, updates) => {
        const now = new Date().toISOString();
        const { currentUser } = get();
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  ...updates,
                  lastModified: now,
                  lastModifier: currentUser,
                  isManualModified: true,
                }
              : r
          ),
        }));
      },

      deleteRecord: (recordId) => {
        set((state) => ({
          records: state.records.filter((r) => r.id !== recordId),
          histories: state.histories.filter((h) => h.recordId !== recordId),
        }));
      },

      importRecords: (importedRecords) => {
        const now = new Date().toISOString();
        const { currentUser } = get();
        const newRecords: SunshineRecord[] = importedRecords.map((r) => ({
          ...r,
          id: generateId(),
          importTime: now,
          lastModified: now,
          sourceType: 'import',
          isManualModified: false,
          status: 'pending' as RecordStatus,
          importer: currentUser,
          lastModifier: currentUser,
          currentHandler: currentUser,
        }));
        set((state) => ({
          records: [...state.records, ...newRecords],
        }));
      },

      getRecordHistories: (recordId) => {
        return get().histories.filter((h) => h.recordId === recordId).sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime());
      },

      resetToMockData: () => {
        set({
          records: mockRecords,
          histories: mockHistories,
        });
      },
    }),
    {
      name: 'sunshine-records-storage',
    }
  )
);
