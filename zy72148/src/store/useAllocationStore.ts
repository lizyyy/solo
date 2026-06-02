import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  RoomAllocation,
  Version,
  ChangeLog,
  SourceTrace,
  DataQualityIssue,
  ConflictItem,
  FilterState,
  ImportSourceInfo,
} from '@/types';
import { checkAllDataQuality } from '@/utils/dataQuality';
import { detectConflicts, resolveConflict } from '@/utils/conflictDetection';
import { completeRecord } from '@/utils/import';
import { exportToCSV, exportToJSON, filterRecords } from '@/utils/export';
import { generateId } from '@/utils/storage';
import { sampleAllocations } from '@/data/sampleData';

interface AllocationState {
  allocations: RoomAllocation[];
  versions: Version[];
  changeLogs: ChangeLog[];
  sourceTraces: SourceTrace[];
  qualityIssues: DataQualityIssue[];
  conflicts: ConflictItem[];
  filters: FilterState;
  selectedRecords: string[];
  currentPage: number;
  pageSize: number;
  operator: string;
  isLoading: boolean;

  initSampleData: () => void;
  clearAllData: () => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setCurrentPage: (page: number) => void;
  setOperator: (name: string) => void;
  getFilteredAllocations: () => RoomAllocation[];

  updateRemarks: (id: string, remarks: string) => void;
  updateStatus: (id: string, status: RoomAllocation['status']) => void;
  updateManualTag: (id: string, tag: string) => void;
  toggleSelectRecord: (id: string) => void;
  clearSelection: () => void;

  importVersion: (
    data: Partial<RoomAllocation>[],
    sourceInfo: ImportSourceInfo
  ) => { conflicts: ConflictItem[]; newVersionId: string };
  applyConflictResolution: (
    recordId: string,
    fieldName: string,
    choice: 'keep' | 'adopt',
    newValue?: string
  ) => void;
  finalizeImport: (versionId: string) => void;
  cancelImport: () => void;

  checkQuality: () => void;
  getRecordQuality: (recordId: string) => DataQualityIssue[];
  getRecordChangeLogs: (recordId: string) => ChangeLog[];
  getRecordSourceTrace: (recordId: string) => SourceTrace | undefined;
  getVersionAllocations: (versionId: string) => RoomAllocation[];

  exportCurrent: (format: 'csv' | 'json') => void;
}

const initialFilters: FilterState = {
  tourName: '',
  hotelName: '',
  roomType: '',
  personType: '',
  status: '',
  searchText: '',
  qualityFilter: '',
};

export const useAllocationStore = create<AllocationState>()(
  persist(
    (set, get) => ({
      allocations: [],
      versions: [],
      changeLogs: [],
      sourceTraces: [],
      qualityIssues: [],
      conflicts: [],
      filters: initialFilters,
      selectedRecords: [],
      currentPage: 1,
      pageSize: 10,
      operator: '小孟',
      isLoading: false,

      initSampleData: () => {
        const now = new Date().toISOString();
        const versionId = generateId();
        
        const initialVersion: Version = {
          id: versionId,
          versionName: 'v1 - 初始版本',
          versionNumber: 1,
          sourceFile: '舞台通道表v1.xlsx',
          operator: '小孟',
          changeNote: '导入初始房型分配数据',
          createdAt: now,
          recordCount: sampleAllocations.length,
        };

        const allocationsWithVersion = sampleAllocations.map(a => ({
          ...a,
          id: generateId(),
          versionId,
          createdAt: now,
          updatedAt: now,
        }));

        const sourceTraces = allocationsWithVersion.map(a => ({
          id: generateId(),
          recordId: a.id,
          fileName: '舞台通道表v1.xlsx',
          importedAt: now,
          operator: '小孟',
          rawData: JSON.stringify(a),
        }));

        const qualityIssues = checkAllDataQuality(allocationsWithVersion);

        set({
          allocations: allocationsWithVersion,
          versions: [initialVersion],
          sourceTraces,
          qualityIssues,
        });
      },

      clearAllData: () => {
        set({
          allocations: [],
          versions: [],
          changeLogs: [],
          sourceTraces: [],
          qualityIssues: [],
          conflicts: [],
          filters: initialFilters,
          selectedRecords: [],
          currentPage: 1,
        });
      },

      setFilters: (newFilters) => {
        set(state => ({
          filters: { ...state.filters, ...newFilters },
          currentPage: 1,
        }));
      },

      resetFilters: () => {
        set({ filters: initialFilters, currentPage: 1 });
      },

      setCurrentPage: (page) => set({ currentPage: page }),
      setOperator: (name) => set({ operator: name }),

      getFilteredAllocations: () => {
        const { allocations, filters, qualityIssues } = get();
        let filtered = filterRecords(allocations, filters);
        
        if (filters.qualityFilter) {
          const issueRecordIds = qualityIssues
            .filter(i => i.type === filters.qualityFilter)
            .map(i => i.recordId);
          filtered = filtered.filter(r => issueRecordIds.includes(r.id));
        }
        
        return filtered;
      },

      updateRemarks: (id, remarks) => {
        const { allocations, changeLogs, operator } = get();
        const now = new Date().toISOString();
        const oldRecord = allocations.find(a => a.id === id);
        
        if (!oldRecord) return;

        const newChangeLog: ChangeLog = {
          id: generateId(),
          recordId: id,
          versionId: oldRecord.versionId,
          fieldName: 'remarks',
          oldValue: oldRecord.remarks,
          newValue: remarks,
          operator,
          changedAt: now,
        };

        set({
          allocations: allocations.map(a =>
            a.id === id ? { ...a, remarks, updatedAt: now } : a
          ),
          changeLogs: [...changeLogs, newChangeLog],
        });

        get().checkQuality();
      },

      updateStatus: (id, status) => {
        const { allocations, changeLogs, operator } = get();
        const now = new Date().toISOString();
        const oldRecord = allocations.find(a => a.id === id);
        
        if (!oldRecord) return;

        const newChangeLog: ChangeLog = {
          id: generateId(),
          recordId: id,
          versionId: oldRecord.versionId,
          fieldName: 'status',
          oldValue: oldRecord.status,
          newValue: status,
          operator,
          changedAt: now,
        };

        set({
          allocations: allocations.map(a =>
            a.id === id ? { ...a, status, updatedAt: now } : a
          ),
          changeLogs: [...changeLogs, newChangeLog],
        });
      },

      updateManualTag: (id, tag) => {
        const { allocations, changeLogs, operator } = get();
        const now = new Date().toISOString();
        const oldRecord = allocations.find(a => a.id === id);
        
        if (!oldRecord) return;

        const newChangeLog: ChangeLog = {
          id: generateId(),
          recordId: id,
          versionId: oldRecord.versionId,
          fieldName: 'manualTag',
          oldValue: oldRecord.manualTag || '',
          newValue: tag,
          operator,
          changedAt: now,
        };

        set({
          allocations: allocations.map(a =>
            a.id === id ? { ...a, manualTag: tag, updatedAt: now } : a
          ),
          changeLogs: [...changeLogs, newChangeLog],
        });
      },

      toggleSelectRecord: (id) => {
        set(state => ({
          selectedRecords: state.selectedRecords.includes(id)
            ? state.selectedRecords.filter(r => r !== id)
            : [...state.selectedRecords, id],
        }));
      },

      clearSelection: () => set({ selectedRecords: [] }),

      importVersion: (data, sourceInfo) => {
        const { allocations, versions, operator } = get();
        const now = new Date().toISOString();
        const nextVersionNumber = versions.length > 0 
          ? Math.max(...versions.map(v => v.versionNumber)) + 1
          : 1;
        const versionId = generateId();
        const source = sourceInfo.fileName;

        const completedRecords = data.map(partial =>
          completeRecord(partial, versionId, source)
        );

        const conflicts = detectConflicts(allocations, data);

        set({ conflicts });

        return { conflicts, newVersionId: versionId };
      },

      applyConflictResolution: (recordId, fieldName, choice, newValue) => {
        const { allocations, conflicts, changeLogs, operator } = get();
        const now = new Date().toISOString();
        const conflict = conflicts.find(
          c => c.recordId === recordId && c.fieldName === fieldName
        );
        
        if (!conflict) return;

        const valueToUse = choice === 'adopt' ? conflict.newValue : (newValue || conflict.oldValue);
        const oldRecord = allocations.find(a => a.id === recordId);
        
        if (!oldRecord) return;

        const newChangeLog: ChangeLog = {
          id: generateId(),
          recordId,
          versionId: oldRecord.versionId,
          fieldName,
          oldValue: conflict.oldValue,
          newValue: valueToUse,
          operator,
          changedAt: now,
        };

        set({
          allocations: allocations.map(a =>
            a.id === recordId
              ? { ...a, [fieldName]: valueToUse, updatedAt: now }
              : a
          ),
          conflicts: resolveConflict(conflicts, recordId, fieldName, choice),
          changeLogs: [...changeLogs, newChangeLog],
        });

        get().checkQuality();
      },

      finalizeImport: (versionId) => {
        const { allocations, versions, sourceTraces, operator } = get();
        const now = new Date().toISOString();
        const nextVersionNumber = versions.length > 0 
          ? Math.max(...versions.map(v => v.versionNumber)) + 1
          : 1;

        const newVersion: Version = {
          id: versionId,
          versionName: `v${nextVersionNumber}`,
          versionNumber: nextVersionNumber,
          sourceFile: '导入文件',
          operator,
          changeNote: '版本导入',
          createdAt: now,
          recordCount: allocations.length,
        };

        const newSourceTraces = allocations
          .filter(a => a.versionId === versionId)
          .map(a => ({
            id: generateId(),
            recordId: a.id,
            fileName: newVersion.sourceFile,
            importedAt: now,
            operator,
            rawData: JSON.stringify(a),
          }));

        set({
          versions: [...versions, newVersion],
          sourceTraces: [...sourceTraces, ...newSourceTraces],
          conflicts: [],
        });

        get().checkQuality();
      },

      cancelImport: () => {
        set({ conflicts: [] });
      },

      checkQuality: () => {
        const { allocations } = get();
        const qualityIssues = checkAllDataQuality(allocations);
        set({ qualityIssues });
      },

      getRecordQuality: (recordId) => {
        const { qualityIssues } = get();
        return qualityIssues.filter(i => i.recordId === recordId);
      },

      getRecordChangeLogs: (recordId) => {
        const { changeLogs } = get();
        return changeLogs.filter(l => l.recordId === recordId).sort(
          (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
        );
      },

      getRecordSourceTrace: (recordId) => {
        const { sourceTraces } = get();
        return sourceTraces.find(t => t.recordId === recordId);
      },

      getVersionAllocations: (versionId) => {
        const { allocations } = get();
        return allocations.filter(a => a.versionId === versionId);
      },

      exportCurrent: (format) => {
        const { allocations, filters } = get();
        if (format === 'csv') {
          exportToCSV(allocations, filters);
        } else {
          exportToJSON(allocations, filters);
        }
      },
    }),
    {
      name: 'hotel-allocation-storage',
      partialize: (state) => ({
        allocations: state.allocations,
        versions: state.versions,
        changeLogs: state.changeLogs,
        sourceTraces: state.sourceTraces,
        qualityIssues: state.qualityIssues,
        filters: state.filters,
        selectedRecords: state.selectedRecords,
        operator: state.operator,
      }),
    }
  )
);
