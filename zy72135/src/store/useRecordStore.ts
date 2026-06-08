import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackCleanupRecord, FilterState, VersionHistory, RecordStatus } from '../../shared/types';
import { statusLabels as allStatusLabels } from '../../shared/types';
import { mockRecords, mockVersionHistory } from '../data/mockData';

function nowISOString(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function generateId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

  setFilters: (filters: Partial<FilterState>) => void;
  initializeRecords: () => void;
  fetchRecord: (id: string) => void;
  updateRecordNote: (id: string, note: string, modifiedBy?: string) => void;
  updateRecordStatus: (id: string, status: TrackCleanupRecord['status'], modifiedBy?: string) => void;
  supplementRecord: (id: string, oldChannelInfo: string, modifiedBy?: string) => void;
  exportCsv: () => void;
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

      setFilters: (filters) => {
        set((state) => {
          const newFilters = { ...state.filters, ...filters };
          return {
            filters: newFilters,
            records: applyFilters(state.allRecords, newFilters),
          };
        });
      },

      initializeRecords: () => {
        const { allRecords } = get();
        if (allRecords.length > 0) {
          const { filters } = get();
          set({ records: applyFilters(allRecords, filters) });
          return;
        }
        const { filters } = get();
        set({
          allRecords: [...mockRecords],
          records: applyFilters(mockRecords, filters),
          versionHistories: {
            rec_001: [...mockVersionHistory.filter((v) => v.recordId === 'rec_001')],
          },
        });
      },

      fetchRecord: (id: string) => {
        const { allRecords } = get();
        const record = allRecords.find((r) => r.id === id);
        set({ currentRecord: record || null });
      },

      updateRecordNote: (id: string, note: string, modifiedBy: string = '小孟') => {
        set((state) => {
          const current = state.allRecords.find((r) => r.id === id);
          if (!current) return state;

          const updated: TrackCleanupRecord = {
            ...current,
            currentNote: note,
            latestHandler: modifiedBy,
            latestHandleTime: nowISOString(),
            updatedAt: new Date().toISOString(),
          };

          const versionEntry: VersionHistory = {
            id: generateId(),
            recordId: id,
            fieldName: '备注',
            oldValue: current.currentNote || '(空)',
            newValue: note || '(空)',
            modifiedBy,
            modifiedAt: new Date().toISOString(),
          };

          const existingHistory = state.versionHistories[id] || [];
          const newAllRecords = state.allRecords.map((r) => (r.id === id ? updated : r));

          return {
            saveStatus: 'saved',
            allRecords: newAllRecords,
            records: applyFilters(newAllRecords, state.filters),
            currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
            versionHistories: {
              ...state.versionHistories,
              [id]: [versionEntry, ...existingHistory],
            },
          };
        });
      },

      updateRecordStatus: (
        id: string,
        status: TrackCleanupRecord['status'],
        modifiedBy: string = '小孟'
      ) => {
        set((state) => {
          const current = state.allRecords.find((r) => r.id === id);
          if (!current) return state;

          const updated: TrackCleanupRecord = {
            ...current,
            status,
            latestHandler: modifiedBy,
            latestHandleTime: nowISOString(),
            updatedAt: new Date().toISOString(),
          };

          const versionEntry: VersionHistory = {
            id: generateId(),
            recordId: id,
            fieldName: '状态',
            oldValue: allStatusLabels[current.status] || current.status,
            newValue: allStatusLabels[status] || status,
            modifiedBy,
            modifiedAt: new Date().toISOString(),
          };

          const existingHistory = state.versionHistories[id] || [];
          const newAllRecords = state.allRecords.map((r) => (r.id === id ? updated : r));

          return {
            saveStatus: 'saved',
            allRecords: newAllRecords,
            records: applyFilters(newAllRecords, state.filters),
            currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
            versionHistories: {
              ...state.versionHistories,
              [id]: [versionEntry, ...existingHistory],
            },
          };
        });
      },

      supplementRecord: (id: string, oldChannelInfo: string, modifiedBy: string = '小孟') => {
        set((state) => {
          const current = state.allRecords.find((r) => r.id === id);
          if (!current) return state;

          const newNote = current.currentNote
            ? `${current.currentNote}\n\n【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`
            : `【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`;

          const updated: TrackCleanupRecord = {
            ...current,
            currentNote: newNote,
            source: 'imported_old',
            latestHandler: modifiedBy,
            latestHandleTime: nowISOString(),
            updatedAt: new Date().toISOString(),
          };

          const versionEntry: VersionHistory = {
            id: generateId(),
            recordId: id,
            fieldName: '补充材料',
            oldValue: current.currentNote || '(空)',
            newValue: `追加舞台通道表旧口径: ${oldChannelInfo}`,
            modifiedBy,
            modifiedAt: new Date().toISOString(),
          };

          const existingHistory = state.versionHistories[id] || [];
          const newAllRecords = state.allRecords.map((r) => (r.id === id ? updated : r));

          return {
            saveStatus: 'saved',
            allRecords: newAllRecords,
            records: applyFilters(newAllRecords, state.filters),
            currentRecord: state.currentRecord?.id === id ? updated : state.currentRecord,
            versionHistories: {
              ...state.versionHistories,
              [id]: [versionEntry, ...existingHistory],
            },
          };
        });
      },

      exportCsv: () => {
        const { records } = get();
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

        const headers = [
          '曲目名称',
          '艺人/学生',
          '状态',
          '来源',
          '特殊标记',
          '处理备注',
          '最后处理人',
          '最后处理时间',
          '原始来源',
          '原始处理时间',
        ];
        const rows = records.map((r) => {
          const flags: string[] = [];
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
          ]
            .map((v) => `"${v.replace(/"/g, '""')}"`)
            .join(',');
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
