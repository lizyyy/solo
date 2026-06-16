import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackCleanupRecord, FilterState, VersionHistory } from '../../shared/types';
import { statusLabels as allStatusLabels } from '../../shared/types';
import { mockRecords, mockVersionHistory } from '../data/mockData';
import * as api from '../api/client';

function applyFilters(
  records: TrackCleanupRecord[],
  filters?: FilterState
): TrackCleanupRecord[] {
  let result = [...records];
  if (filters?.status) {
    result = result.filter((r) => r.status === filters.status);
  }
  if (filters?.source) {
    result = result.filter((r) => r.source === filters.source);
  }
  if (filters?.searchKeyword) {
    const keyword = filters.searchKeyword.toLowerCase();
    result = result.filter(
      (r) =>
        r.trackName.toLowerCase().includes(keyword) ||
        r.artistName.toLowerCase().includes(keyword) ||
        r.currentNote.toLowerCase().includes(keyword)
    );
  }
  return result.sort((a, b) => b.latestHandleTime.localeCompare(a.latestHandleTime));
}

interface RecordState {
  records: TrackCleanupRecord[];
  allRecords: TrackCleanupRecord[];
  currentRecord: TrackCleanupRecord | null;
  versionHistories: Record<string, VersionHistory[]>;
  filters: FilterState;
  loading: boolean;
  error: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  backendAvailable: boolean;

  setFilters: (filters: Partial<FilterState>) => void;
  fetchRecords: () => Promise<void>;
  fetchRecord: (id: string) => Promise<void>;
  fetchVersionHistory: (id: string) => Promise<void>;
  updateRecordNote: (id: string, note: string, modifiedBy?: string) => Promise<void>;
  updateRecordStatus: (id: string, status: TrackCleanupRecord['status'], modifiedBy?: string) => Promise<void>;
  supplementRecord: (id: string, oldChannelInfo: string, modifiedBy?: string) => Promise<void>;
  exportCsv: () => Promise<void>;
  clearSaveStatus: () => void;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],
      allRecords: [],
      currentRecord: null,
      versionHistories: {},
      filters: {},
      loading: false,
      error: null,
      saveStatus: 'idle',
      backendAvailable: false,

      setFilters: (filters) => {
        set((state) => {
          const newFilters = { ...state.filters, ...filters };
          return {
            filters: newFilters,
            records: applyFilters(state.allRecords, newFilters),
          };
        });
      },

      fetchRecords: async () => {
        set({ loading: true, error: null });
        try {
          const { filters } = get();
          const records = await api.getRecords(filters);
          set({
            allRecords: records,
            records: applyFilters(records, filters),
            loading: false,
            backendAvailable: true,
          });
        } catch {
          const { allRecords, filters } = get();
          if (allRecords.length === 0) {
            set({
              allRecords: [...mockRecords],
              records: applyFilters(mockRecords, filters),
              versionHistories: {
                rec_001: [...mockVersionHistory.filter((v) => v.recordId === 'rec_001')],
              },
            });
          } else {
            set({ records: applyFilters(allRecords, filters) });
          }
          set({ loading: false, backendAvailable: false });
        }
      },

      fetchRecord: async (id: string) => {
        set({ loading: true, error: null });
        try {
          const record = await api.getRecord(id);
          set({ currentRecord: record, loading: false, backendAvailable: true });
        } catch {
          const { allRecords } = get();
          const record = allRecords.find((r) => r.id === id) || mockRecords.find((r) => r.id === id);
          set({ currentRecord: record || null, loading: false, backendAvailable: false });
        }
      },

      fetchVersionHistory: async (id: string) => {
        try {
          const history = await api.getRecordVersions(id);
          set((state) => ({
            versionHistories: { ...state.versionHistories, [id]: history },
            backendAvailable: true,
          }));
        } catch {
          const { versionHistories } = get();
          if (!versionHistories[id]) {
            const history = mockVersionHistory.filter((v) => v.recordId === id);
            set((state) => ({
              versionHistories: { ...state.versionHistories, [id]: history },
            }));
          }
          set({ backendAvailable: false });
        }
      },

      updateRecordNote: async (id: string, note: string, modifiedBy: string = '小孟') => {
        set({ saveStatus: 'saving' });
        try {
          const updated = await api.updateRecord(id, {
            currentNote: note,
            latestHandler: modifiedBy,
            latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
            modifiedBy,
          });
          await get().fetchVersionHistory(id);
          set((state) => {
            const newAllRecords = state.allRecords.map((r) => (r.id === id ? updated : r));
            return {
              saveStatus: 'saved',
              allRecords: newAllRecords,
              records: applyFilters(newAllRecords, state.filters),
              currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
              backendAvailable: true,
            };
          });
        } catch {
          const { allRecords, currentRecord, versionHistories, filters } = get();
          const current = currentRecord || allRecords.find((r) => r.id === id);
          if (!current) { set({ saveStatus: 'error' }); return; }

          const updated: TrackCleanupRecord = {
            ...current,
            currentNote: note,
            latestHandler: modifiedBy,
            latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
            updatedAt: new Date().toISOString(),
          };
          const versionEntry: VersionHistory = {
            id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            recordId: id,
            fieldName: '备注',
            oldValue: current.currentNote || '(空)',
            newValue: note || '(空)',
            modifiedBy,
            modifiedAt: new Date().toISOString(),
          };
          const existingHistory = versionHistories[id] || [];
          const newAllRecords = allRecords.map((r) => (r.id === id ? updated : r));
          set({
            saveStatus: 'saved',
            allRecords: newAllRecords,
            records: applyFilters(newAllRecords, filters),
            currentRecord: currentRecord?.id === id ? updated : currentRecord,
            versionHistories: { ...versionHistories, [id]: [versionEntry, ...existingHistory] },
            backendAvailable: false,
          });
        }
      },

      updateRecordStatus: async (
        id: string,
        status: TrackCleanupRecord['status'],
        modifiedBy: string = '小孟'
      ) => {
        set({ saveStatus: 'saving' });
        try {
          const updated = await api.updateRecord(id, {
            status,
            latestHandler: modifiedBy,
            latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
            modifiedBy,
          });
          await get().fetchVersionHistory(id);
          set((state) => {
            const newAllRecords = state.allRecords.map((r) => (r.id === id ? updated : r));
            return {
              saveStatus: 'saved',
              allRecords: newAllRecords,
              records: applyFilters(newAllRecords, state.filters),
              currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
              backendAvailable: true,
            };
          });
        } catch {
          const { allRecords, currentRecord, versionHistories, filters } = get();
          const current = currentRecord || allRecords.find((r) => r.id === id);
          if (!current) { set({ saveStatus: 'error' }); return; }

          const updated: TrackCleanupRecord = {
            ...current,
            status,
            latestHandler: modifiedBy,
            latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
            updatedAt: new Date().toISOString(),
          };
          const versionEntry: VersionHistory = {
            id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            recordId: id,
            fieldName: '状态',
            oldValue: allStatusLabels[current.status] || current.status,
            newValue: allStatusLabels[status] || status,
            modifiedBy,
            modifiedAt: new Date().toISOString(),
          };
          const existingHistory = versionHistories[id] || [];
          const newAllRecords = allRecords.map((r) => (r.id === id ? updated : r));
          set({
            saveStatus: 'saved',
            allRecords: newAllRecords,
            records: applyFilters(newAllRecords, filters),
            currentRecord: currentRecord?.id === id ? updated : currentRecord,
            versionHistories: { ...versionHistories, [id]: [versionEntry, ...existingHistory] },
            backendAvailable: false,
          });
        }
      },

      supplementRecord: async (id: string, oldChannelInfo: string, modifiedBy: string = '小孟') => {
        set({ saveStatus: 'saving' });
        try {
          const updated = await api.supplementRecord(id, oldChannelInfo, modifiedBy);
          await get().fetchVersionHistory(id);
          set((state) => {
            const newAllRecords = state.allRecords.map((r) => (r.id === id ? updated : r));
            return {
              saveStatus: 'saved',
              allRecords: newAllRecords,
              records: applyFilters(newAllRecords, state.filters),
              currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
              backendAvailable: true,
            };
          });
        } catch {
          const { allRecords, currentRecord, versionHistories, filters } = get();
          const current = currentRecord || allRecords.find((r) => r.id === id);
          if (!current) { set({ saveStatus: 'error' }); return; }

          const newNote = current.currentNote
            ? `${current.currentNote}\n\n【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`
            : `【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`;
          const updated: TrackCleanupRecord = {
            ...current,
            currentNote: newNote,
            source: 'imported_old',
            latestHandler: modifiedBy,
            latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
            updatedAt: new Date().toISOString(),
          };
          const versionEntry: VersionHistory = {
            id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            recordId: id,
            fieldName: '补充材料',
            oldValue: current.currentNote || '(空)',
            newValue: `追加舞台通道表旧口径: ${oldChannelInfo}`,
            modifiedBy,
            modifiedAt: new Date().toISOString(),
          };
          const existingHistory = versionHistories[id] || [];
          const newAllRecords = allRecords.map((r) => (r.id === id ? updated : r));
          set({
            saveStatus: 'saved',
            allRecords: newAllRecords,
            records: applyFilters(newAllRecords, filters),
            currentRecord: currentRecord?.id === id ? updated : currentRecord,
            versionHistories: { ...versionHistories, [id]: [versionEntry, ...existingHistory] },
            backendAvailable: false,
          });
        }
      },

      exportCsv: async () => {
        const { filters, backendAvailable } = get();
        try {
          if (backendAvailable) {
            await api.exportRecordsCsv(filters);
            return;
          }
        } catch {}
        const { records } = get();
        const statusLabels: Record<string, string> = {
          pending: '待确认', approved: '已通过', needs_supplement: '需补充', obsolete: '已作废',
        };
        const sourceLabels: Record<string, string> = {
          stage_channel: '舞台通道表', manual: '人工补录', imported_old: '导入旧记录',
        };
        const headers = [
          '曲目名称', '艺人/学生', '状态', '来源', '特殊标记',
          '处理备注', '最后处理人', '最后处理时间', '原始来源', '原始处理时间',
        ];
        const rows = records.map((r) => {
          const flags: string[] = [];
          if (r.isOldMaster) flags.push('旧版母带');
          if (r.isDuplicate) flags.push('重复曲目');
          if (!r.hasAuthorization) flags.push('缺授权');
          if (r.isRenamed) flags.push(`人工改名(原:${r.originalTrackName})`);
          return [
            r.trackName, r.artistName, statusLabels[r.status], sourceLabels[r.source],
            flags.join('、') || '无', r.currentNote.replace(/\n/g, ' '),
            r.latestHandler, r.latestHandleTime, r.originalSource, r.originalHandleTime,
          ].map((v) => `"${v.replace(/"/g, '""')}"`).join(',');
        });
        const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `编曲工程轨道清理清单_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },

      clearSaveStatus: () => {
        set({ saveStatus: 'idle' });
      },
    }),
    {
      name: 'track-cleanup-storage',
      partialize: (state) => ({
        filters: state.filters,
        allRecords: state.allRecords,
        versionHistories: state.versionHistories,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.allRecords.length > 0) {
          state.records = applyFilters(state.allRecords, state.filters);
        }
      },
    }
  )
);
