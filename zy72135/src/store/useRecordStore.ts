import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackCleanupRecord, FilterState, VersionHistory } from '../../shared/types';
import * as api from '../api/client';
import { mockRecords, mockVersionHistory, getFilteredMockRecords } from '../data/mockData';

interface RecordState {
  records: TrackCleanupRecord[];
  currentRecord: TrackCleanupRecord | null;
  versionHistory: VersionHistory[];
  filters: FilterState;
  loading: boolean;
  error: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

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
      currentRecord: null,
      versionHistory: [],
      filters: {},
      loading: false,
      error: null,
      saveStatus: 'idle',

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      fetchRecords: async () => {
        set({ loading: true, error: null });
        try {
          const { filters } = get();
          const records = await api.getRecords(filters);
          set({ records, loading: false });
        } catch (error) {
          const { filters } = get();
          const records = getFilteredMockRecords(filters);
          set({ records, loading: false });
        }
      },

      fetchRecord: async (id: string) => {
        set({ loading: true, error: null });
        try {
          const record = await api.getRecord(id);
          set({ currentRecord: record, loading: false });
        } catch (error) {
          const record = mockRecords.find((r) => r.id === id);
          set({ currentRecord: record || null, loading: false });
        }
      },

      fetchVersionHistory: async (id: string) => {
        try {
          const history = await api.getRecordVersions(id);
          set({ versionHistory: history });
        } catch (error) {
          const history = mockVersionHistory.filter((v) => v.recordId === id);
          set({ versionHistory: history });
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
          set((state) => ({
            saveStatus: 'saved',
            records: state.records.map((r) => (r.id === id ? updated : r)),
            currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
          }));
        } catch (error) {
          set((state) => {
            const updated = {
              ...(state.currentRecord || mockRecords.find((r) => r.id === id)!),
              currentNote: note,
              latestHandler: modifiedBy,
              latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
              updatedAt: new Date().toISOString(),
            };
            return {
              saveStatus: 'saved',
              records: state.records.map((r) => (r.id === id ? updated : r)),
              currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
            };
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
          set((state) => ({
            saveStatus: 'saved',
            records: state.records.map((r) => (r.id === id ? updated : r)),
            currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
          }));
        } catch (error) {
          set((state) => {
            const updated = {
              ...(state.currentRecord || mockRecords.find((r) => r.id === id)!),
              status,
              latestHandler: modifiedBy,
              latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
              updatedAt: new Date().toISOString(),
            };
            return {
              saveStatus: 'saved',
              records: state.records.map((r) => (r.id === id ? updated : r)),
              currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
            };
          });
        }
      },

      supplementRecord: async (id: string, oldChannelInfo: string, modifiedBy: string = '小孟') => {
        set({ saveStatus: 'saving' });
        try {
          const updated = await api.supplementRecord(id, oldChannelInfo, modifiedBy);
          set((state) => ({
            saveStatus: 'saved',
            records: state.records.map((r) => (r.id === id ? updated : r)),
            currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
          }));
        } catch (error) {
          set((state) => {
            const current = state.currentRecord || mockRecords.find((r) => r.id === id)!;
            const newNote = current.currentNote
              ? `${current.currentNote}\n\n【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`
              : `【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`;
            const updated = {
              ...current,
              currentNote: newNote,
              source: 'imported_old' as const,
              latestHandler: modifiedBy,
              latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
              updatedAt: new Date().toISOString(),
            };
            return {
              saveStatus: 'saved',
              records: state.records.map((r) => (r.id === id ? updated : r)),
              currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
            };
          });
        }
      },

      exportCsv: async () => {
        const { filters } = get();
        try {
          await api.exportRecordsCsv(filters);
        } catch (error) {
          const records = getFilteredMockRecords(filters);
          const statusLabels: Record<string, string> = {
            pending: '待确认',
            approved: '已通过',
            needs_supplement: '需补充',
            obsolete: '已作废',
          };
          const sourceLabels: Record<string, string> = {
            stage_channel: '舞台通道表',
            manual: '人工补录',
            imported_old: '导入旧记录',
          };
          
          const headers = ['曲目名称', '艺人/学生', '状态', '来源', '特殊标记', '处理备注', '最后处理人', '最后处理时间', '原始来源', '原始处理时间'];
          const rows = records.map((r) => {
            const flags = [];
            if (r.isOldMaster) flags.push('旧版母带');
            if (r.isDuplicate) flags.push('重复曲目');
            if (!r.hasAuthorization) flags.push('缺授权');
            if (r.isRenamed) flags.push(`人工改名(原:${r.originalTrackName})`);
            return [
              r.trackName,
              r.artistName,
              statusLabels[r.status],
              sourceLabels[r.source],
              flags.join('、') || '无',
              r.currentNote.replace(/\n/g, ' '),
              r.latestHandler,
              r.latestHandleTime,
              r.originalSource,
              r.originalHandleTime,
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
        }
      },

      clearSaveStatus: () => {
        set({ saveStatus: 'idle' });
      },
    }),
    {
      name: 'track-cleanup-storage',
      partialize: (state) => ({ filters: state.filters, records: state.records }),
    }
  )
);
