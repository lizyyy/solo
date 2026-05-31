import { create } from 'zustand';
import type { 
  ArchiveRecord, 
  FilterState, 
  Student, 
  StatsOverview,
  DuplicateResult,
  HumanError,
} from '../types';
import { getMockRecords, getMockStudents } from '../data/mockData';
import { getStoredRecords, setStoredRecords } from '../utils/storage';
import { TranspositionValidator } from '../services/TranspositionValidator';
import { DuplicateDetector } from '../services/DuplicateDetector';
import { UrlStateSync } from '../services/UrlStateSync';
import { HumanErrorHandler, AppError } from '../services/HumanErrorHandler';
import { isSameDay, startOfDay } from 'date-fns';

interface ArchiveState {
  records: ArchiveRecord[];
  students: Student[];
  filterState: FilterState;
  isLoading: boolean;
  error: HumanError | null;
  duplicates: DuplicateResult[];
  stats: StatsOverview;
  currentUser: string;
}

interface ArchiveActions {
  init: () => void;
  setFilterState: (state: Partial<FilterState>) => void;
  resetFilterState: () => void;
  syncFilterToUrl: () => void;
  syncFilterFromUrl: () => void;
  getFilteredRecords: () => ArchiveRecord[];
  getPaginatedRecords: () => { items: ArchiveRecord[]; total: number };
  getRecordById: (id: string) => ArchiveRecord | undefined;
  getDuplicates: () => DuplicateResult[];
  getStats: () => StatsOverview;
  updateRecordTransposition: (
    recordId: string, 
    sourceType: 'metronome' | 'song_list' | 'sheet_music',
    newKey: number,
    changeType: 'supplement' | 'revision'
  ) => { success: boolean; error?: HumanError };
  resolveDuplicate: (
    duplicateResult: DuplicateResult, 
    keepRecordId: string,
    mergeData: boolean
  ) => { success: boolean; error?: HumanError };
  clearError: () => void;
  setError: (error: HumanError) => void;
  exportSummary: (records: ArchiveRecord[]) => { success: boolean; error?: HumanError; blob?: Blob };
}

const calculateStats = (records: ArchiveRecord[]): StatsOverview => {
  const today = startOfDay(new Date());
  
  return {
    todayNew: records.filter(r => isSameDay(r.createdAt, today)).length,
    pendingDuplicates: records.filter(r => r.status === 'duplicate').length,
    transpositionMismatches: records.filter(r => r.status === 'transposition_mismatch').length,
    supplementsCount: records.filter(r => r.changeType === 'supplement').length,
  };
};

const validateRecordsStatus = (records: ArchiveRecord[]): ArchiveRecord[] => {
  return records.map(record => {
    const transpositionResult = TranspositionValidator.validate(record);
    const duplicates = DuplicateDetector.detect(records);
    const isDuplicate = duplicates.some(
      d => d.record1.id === record.id || d.record2.id === record.id
    );
    
    let status: ArchiveRecord['status'] = 'normal';
    if (isDuplicate) {
      status = 'duplicate';
    } else if (!transpositionResult.isSynced) {
      status = 'transposition_mismatch';
    }
    
    const duplicateMatch = duplicates.find(
      d => d.record1.id === record.id || d.record2.id === record.id
    );
    
    return {
      ...record,
      status,
      transposition: {
        ...record.transposition,
        isSynced: transpositionResult.isSynced,
        mismatchNote: !transpositionResult.isSynced 
          ? transpositionResult.humanMessage.split('\n').pop()
          : undefined,
      },
      duplicateInfo: duplicateMatch ? {
        duplicateWithId: duplicateMatch.record1.id === record.id 
          ? duplicateMatch.record2.id 
          : duplicateMatch.record1.id,
        conflictFields: duplicateMatch.conflictFields,
        suggestedHandler: duplicateMatch.suggestedHandler,
        suggestedAction: duplicateMatch.suggestedAction,
        sourceComparison: duplicateMatch.sourceComparison,
      } : undefined,
    };
  });
};

export const useArchiveStore = create<ArchiveState & ArchiveActions>((set, get) => ({
  records: [],
  students: [],
  filterState: UrlStateSync.getDefaultState(),
  isLoading: false,
  error: null,
  duplicates: [],
  stats: {
    todayNew: 0,
    pendingDuplicates: 0,
    transpositionMismatches: 0,
    supplementsCount: 0,
  },
  currentUser: '李老师',

  init: () => {
    try {
      set({ isLoading: true });
      
      let records = getStoredRecords();
      if (!records || records.length === 0) {
        records = getMockRecords();
        setStoredRecords(records);
      }
      
      records = validateRecordsStatus(records);
      const students = getMockStudents();
      const duplicates = DuplicateDetector.detect(records);
      const stats = calculateStats(records);
      
      set({ 
        records, 
        students, 
        duplicates,
        stats,
        isLoading: false 
      });
      
      get().syncFilterFromUrl();
    } catch (e) {
      const error = HumanErrorHandler.translate(e as Error, {
        userAction: '初始化数据',
      });
      set({ error, isLoading: false });
    }
  },

  setFilterState: (newState) => {
    set(state => {
      const updated = { ...state.filterState, ...newState, page: 1 };
      return { filterState: updated };
    });
    get().syncFilterToUrl();
  },

  resetFilterState: () => {
    const defaultState = UrlStateSync.resetState();
    set({ filterState: defaultState });
    get().syncFilterToUrl();
  },

  syncFilterToUrl: () => {
    try {
      UrlStateSync.syncToUrl(get().filterState);
    } catch (e) {
      console.error('Failed to sync filter to URL:', e);
    }
  },

  syncFilterFromUrl: () => {
    try {
      const state = UrlStateSync.syncFromUrl();
      set({ filterState: state });
    } catch (e) {
      const error = HumanErrorHandler.createError('FILTER_STATE_INVALID');
      set({ error });
    }
  },

  getFilteredRecords: () => {
    const { records, filterState } = get();
    let filtered = [...records];

    if (filterState.studentId) {
      filtered = filtered.filter(r => r.studentId === filterState.studentId);
    }

    if (filterState.dateRange) {
      const [from, to] = filterState.dateRange;
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => {
        const recordDate = new Date(r.createdAt);
        return recordDate >= fromDate && recordDate <= toDate;
      });
    }

    if (filterState.sourceTypes && filterState.sourceTypes.length > 0) {
      filtered = filtered.filter(r => 
        r.sources.some(s => filterState.sourceTypes!.includes(s.sourceType))
      );
    }

    if (filterState.changeTypes && filterState.changeTypes.length > 0) {
      filtered = filtered.filter(r => 
        filterState.changeTypes!.includes(r.changeType)
      );
    }

    if (filterState.statuses && filterState.statuses.length > 0) {
      filtered = filtered.filter(r => 
        filterState.statuses!.includes(r.status)
      );
    }

    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.pieceName.toLowerCase().includes(query) ||
        r.student.name.toLowerCase().includes(query) ||
        r.createdBy.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  getPaginatedRecords: () => {
    const filtered = get().getFilteredRecords();
    const { page, pageSize } = get().filterState;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      items: filtered.slice(start, end),
      total: filtered.length,
    };
  },

  getRecordById: (id) => {
    return get().records.find(r => r.id === id);
  },

  getDuplicates: () => {
    return DuplicateDetector.detect(get().records);
  },

  getStats: () => {
    return calculateStats(get().records);
  },

  updateRecordTransposition: (recordId, sourceType, newKey, changeType) => {
    try {
      const { records } = get();
      const recordIndex = records.findIndex(r => r.id === recordId);
      
      if (recordIndex === -1) {
        return { 
          success: false, 
          error: HumanErrorHandler.createError('UNKNOWN_ERROR', {
            userAction: '更新转调',
            recordId,
          })
        };
      }

      const record = records[recordIndex];
      const sourceTypeToKeyField: Record<string, string> = {
        metronome: 'metronomeKey',
        song_list: 'songListKey',
        sheet_music: 'sheetMusicKey',
      };
      const keyField = sourceTypeToKeyField[sourceType];
      const oldKey = record.transposition?.[keyField as keyof typeof record.transposition];
      
      const newVersion = {
        id: `v${Date.now()}`,
        archiveId: recordId,
        versionNumber: record.versions.length + 1,
        changedAt: new Date(),
        changedBy: get().currentUser,
        changeDescription: `更新${sourceType === 'metronome' ? '节拍器' : sourceType === 'song_list' ? '选曲表' : '曲谱'}转调`,
        changeType,
        diffData: [{
          field: `transposition.${keyField}`,
          oldValue: oldKey,
          newValue: newKey,
        }],
      };

      const updatedRecord = {
        ...record,
        changeType,
        transposition: {
          ...record.transposition,
          [keyField]: newKey,
        } as ArchiveRecord['transposition'],
        versions: [...record.versions, newVersion],
        updatedAt: new Date(),
      };

      let updatedRecords = [...records];
      updatedRecords[recordIndex] = updatedRecord;
      updatedRecords = validateRecordsStatus(updatedRecords);
      
      setStoredRecords(updatedRecords);
      
      const duplicates = DuplicateDetector.detect(updatedRecords);
      const stats = calculateStats(updatedRecords);
      
      set({ 
        records: updatedRecords, 
        duplicates,
        stats,
      });

      return { success: true };
    } catch (e) {
      const error = HumanErrorHandler.translate(e as Error, {
        userAction: '更新转调',
        recordId,
      });
      set({ error });
      return { success: false, error };
    }
  },

  resolveDuplicate: (duplicateResult, keepRecordId, mergeData) => {
    try {
      const { records } = get();
      const { record1, record2 } = duplicateResult;
      const toRemoveId = keepRecordId === record1.id ? record2.id : record1.id;
      const keepRecord = keepRecordId === record1.id ? record1 : record2;
      const removeRecord = keepRecordId === record1.id ? record2 : record1;

      if (!mergeData) {
        const updatedRecords = validateRecordsStatus(
          records.filter(r => r.id !== toRemoveId)
        );
        setStoredRecords(updatedRecords);
        
        const duplicates = DuplicateDetector.detect(updatedRecords);
        const stats = calculateStats(updatedRecords);
        
        set({ 
          records: updatedRecords, 
          duplicates,
          stats,
        });
        
        return { success: true };
      }

      const mergedSources = [...keepRecord.sources];
      for (const source of removeRecord.sources) {
        const exists = mergedSources.some(s => s.sourceType === source.sourceType);
        if (!exists) {
          mergedSources.push({
            ...source,
            archiveId: keepRecord.id,
            id: `src_merged_${Date.now()}_${source.sourceType}`,
          });
        }
      }

      const mergedTransposition = { ...keepRecord.transposition };
      if (removeRecord.transposition) {
        for (const key of ['metronomeKey', 'songListKey', 'sheetMusicKey'] as const) {
          if (removeRecord.transposition[key] !== undefined && 
              mergedTransposition?.[key] === undefined) {
            (mergedTransposition as any)[key] = removeRecord.transposition[key];
          }
        }
      }

      const mergedVersions = [
        ...keepRecord.versions,
        ...removeRecord.versions.map(v => ({
          ...v,
          archiveId: keepRecord.id,
          id: `${v.id}_merged`,
        })),
      ].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
       .map((v, i) => ({ ...v, versionNumber: i + 1 }));

      const updatedRecord: ArchiveRecord = {
        ...keepRecord,
        sources: mergedSources,
        transposition: mergedTransposition,
        versions: mergedVersions,
        updatedAt: new Date(),
        notes: keepRecord.notes 
          ? `${keepRecord.notes}\n合并了记录 ${removeRecord.id} 的数据`
          : `合并了记录 ${removeRecord.id} 的数据`,
      };

      let updatedRecords = records
        .filter(r => r.id !== toRemoveId)
        .map(r => r.id === keepRecord.id ? updatedRecord : r);
      
      updatedRecords = validateRecordsStatus(updatedRecords);
      setStoredRecords(updatedRecords);
      
      const duplicates = DuplicateDetector.detect(updatedRecords);
      const stats = calculateStats(updatedRecords);
      
      set({ 
        records: updatedRecords, 
        duplicates,
        stats,
      });

      return { success: true };
    } catch (e) {
      const error = HumanErrorHandler.translate(e as Error, {
        userAction: '处理重复记录',
      });
      set({ error });
      return { success: false, error };
    }
  },

  clearError: () => {
    set({ error: null });
  },

  setError: (error) => {
    set({ error });
  },

  exportSummary: (records) => {
    try {
      if (records.length === 0) {
        return {
          success: false,
          error: HumanErrorHandler.createError('NO_RECORDS_TO_EXPORT'),
        };
      }

      const { filterState, students } = get();
      const student = filterState.studentId 
        ? students.find(s => s.id === filterState.studentId)
        : undefined;

      const currentHash = UrlStateSync.getStateHash(filterState);
      const expectedRange = UrlStateSync.getRangeDescription(
        filterState, 
        records.length,
        student?.name
      );

      return {
        success: true,
      };
    } catch (e) {
      const error = HumanErrorHandler.translate(e as Error, {
        userAction: '导出排练小结',
      });
      set({ error });
      return { success: false, error };
    }
  },
}));
