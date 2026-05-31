import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuditRecord, ChangeHistory, RecordStatus, User } from '@/types';
import { mockRecords, mockHistory, mockUsers } from '@/mock/initialData';

interface RecordState {
  records: AuditRecord[];
  history: ChangeHistory[];
  users: User[];
  currentUser: User | null;
  selectedIds: Set<string>;
  initialized: boolean;
  
  initData: () => void;
  setCurrentUser: (user: User) => void;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  updateRecordStatus: (recordId: string, newStatus: RecordStatus, reason: string) => void;
  batchUpdateStatus: (recordIds: string[], newStatus: RecordStatus, reason: string) => void;
  getRecordHistory: (recordId: string) => ChangeHistory[];
  getFilteredRecords: (filters: {
    status?: RecordStatus | 'all';
    source?: string;
    type?: string;
    handlerId?: string;
    dateStart?: string;
    dateEnd?: string;
  }) => AuditRecord[];
}

const generateId = () => Math.random().toString(36).substring(2, 10);

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],
      history: [],
      users: mockUsers,
      currentUser: mockUsers[0],
      selectedIds: new Set(),
      initialized: false,

      initData: () => {
        if (get().initialized) return;
        set({
          records: mockRecords,
          history: mockHistory,
          initialized: true,
        });
      },

      setCurrentUser: (user: User) => set({ currentUser: user }),

      toggleSelect: (id: string) => {
        set((state) => {
          const newSelected = new Set(state.selectedIds);
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
          return { selectedIds: newSelected };
        });
      },

      selectAll: (ids: string[]) => {
        set({ selectedIds: new Set(ids) });
      },

      clearSelection: () => {
        set({ selectedIds: new Set() });
      },

      updateRecordStatus: (recordId: string, newStatus: RecordStatus, reason: string) => {
        const { records, history, currentUser } = get();
        const record = records.find((r) => r.id === recordId);
        
        if (!record || record.status === newStatus) return;
        if (!currentUser) return;

        const newHistory: ChangeHistory = {
          id: generateId(),
          recordId,
          fromStatus: record.status,
          toStatus: newStatus,
          reason,
          operatorId: currentUser.id,
          operatorName: currentUser.name,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  status: newStatus,
                  handlerId: currentUser.id,
                  handlerName: currentUser.name,
                  pendingReason: newStatus === 'pending' ? reason : '',
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
          history: [...state.history, newHistory],
        }));
      },

      batchUpdateStatus: (recordIds: string[], newStatus: RecordStatus, reason: string) => {
        const { records, currentUser } = get();
        if (!currentUser) return;

        const newHistories: ChangeHistory[] = [];
        const now = new Date().toISOString();

        recordIds.forEach((recordId) => {
          const record = records.find((r) => r.id === recordId);
          if (!record || record.status === newStatus) return;

          newHistories.push({
            id: generateId(),
            recordId,
            fromStatus: record.status,
            toStatus: newStatus,
            reason,
            operatorId: currentUser.id,
            operatorName: currentUser.name,
            createdAt: now,
          });
        });

        set((state) => ({
          records: state.records.map((r) =>
            recordIds.includes(r.id) && r.status !== newStatus
              ? {
                  ...r,
                  status: newStatus,
                  handlerId: currentUser.id,
                  handlerName: currentUser.name,
                  pendingReason: newStatus === 'pending' ? reason : '',
                  updatedAt: now,
                }
              : r
          ),
          history: [...state.history, ...newHistories],
          selectedIds: new Set(),
        }));
      },

      getRecordHistory: (recordId: string) => {
        return get().history.filter((h) => h.recordId === recordId).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      getFilteredRecords: (filters) => {
        let result = [...get().records];

        if (filters.status && filters.status !== 'all') {
          result = result.filter((r) => r.status === filters.status);
        }

        if (filters.source) {
          result = result.filter((r) => r.source.includes(filters.source!));
        }

        if (filters.type && filters.type !== 'all') {
          result = result.filter((r) => r.type === filters.type);
        }

        if (filters.handlerId) {
          result = result.filter((r) => r.handlerId === filters.handlerId);
        }

        if (filters.dateStart) {
          result = result.filter((r) => r.createdAt >= filters.dateStart!);
        }

        if (filters.dateEnd) {
          result = result.filter((r) => r.createdAt <= filters.dateEnd!);
        }

        return result.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      },
    }),
    {
      name: 'audit-record-storage',
      partialize: (state) => ({
        records: state.records,
        history: state.history,
        initialized: state.initialized,
      }),
    }
  )
);
