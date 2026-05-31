import { create } from 'zustand';
import {
  CableRecord,
  VersionHistory,
  FilterConditions,
  DataSource,
  ResponsiblePerson,
  ImportConflict,
  SuggestedAction,
  CableStatus,
} from '@/types';
import { mockRecords, mockVersionHistories } from '@/data/mockRecords';
import { mockSources } from '@/data/mockSources';
import { mockPersons } from '@/data/mockPersons';
import { detectDuplicates } from '@/utils/duplicateDetector';
import { flipBothCoordinates } from '@/utils/coordinateUtils';
import { generateHumanMessage } from '@/utils/humanMessageGenerator';

interface CableState {
  records: CableRecord[];
  versionHistories: VersionHistory[];
  dataSources: DataSource[];
  persons: ResponsiblePerson[];
  filters: FilterConditions;
  selectedRecordIds: string[];
  conflicts: ImportConflict[];

  setRecords: (records: CableRecord[]) => void;
  addRecord: (record: CableRecord, operator: string, reason: string) => void;
  updateRecord: (id: string, updates: Partial<CableRecord>, operator: string, reason: string) => void;
  rollbackRecord: (recordId: string, versionId: string, operator: string, reason: string) => void;
  deleteRecord: (id: string, operator: string, reason: string) => void;
  setFilters: (filters: Partial<FilterConditions>) => void;
  toggleRecordSelection: (id: string) => void;
  clearSelection: () => void;
  batchUpdateStatus: (ids: string[], status: CableStatus, operator: string) => void;

  importRecords: (
    incoming: Partial<CableRecord>[],
    source: DataSource,
    operator: string
  ) => { conflicts: ImportConflict[]; added: number; skipped: number };
  resolveConflict: (conflictIndex: number, action: SuggestedAction, operator: string) => void;
  resolveAllConflicts: (defaultAction: SuggestedAction, operator: string) => void;

  detectImportConflicts: (incoming: Partial<CableRecord>[], source?: DataSource) => ImportConflict[];
  getRecordVersions: (recordId: string) => VersionHistory[];
  getFilteredRecords: () => CableRecord[];
  getSourceById: (id: string) => DataSource | undefined;
  getPersonById: (id: string) => ResponsiblePerson | undefined;
  setConflicts: (conflicts: ImportConflict[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useCableStore = create<CableState>((set, get) => ({
  records: mockRecords,
  versionHistories: mockVersionHistories,
  dataSources: mockSources,
  persons: mockPersons,
  filters: {
    rooms: [],
    cabinets: [],
    statuses: [],
    sourceTypes: [],
    dateRange: null,
    cableTypes: [],
    searchText: '',
  },
  selectedRecordIds: [],
  conflicts: [],

  setRecords: (records) => set({ records }),

  addRecord: (record, operator, reason) => {
    const now = new Date().toISOString();
    const newRecord: CableRecord = {
      ...record,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const newVersion: VersionHistory = {
      id: generateId(),
      recordId: newRecord.id,
      version: 1,
      snapshot: newRecord,
      operator,
      operation: 'create',
      reason,
      createdAt: now,
    };

    set((state) => ({
      records: [...state.records, newRecord],
      versionHistories: [...state.versionHistories, newVersion],
    }));
  },

  updateRecord: (id, updates, operator, reason) => {
    const now = new Date().toISOString();
    const state = get();
    const record = state.records.find((r) => r.id === id);
    if (!record) return;

    const existingVersions = state.versionHistories.filter((v) => v.recordId === id);
    const newVersionNumber = existingVersions.length + 1;
    const updatedRecord = { ...record, ...updates, updatedAt: now };

    const newVersion: VersionHistory = {
      id: generateId(),
      recordId: id,
      version: newVersionNumber,
      snapshot: updatedRecord,
      operator,
      operation: 'update',
      reason,
      createdAt: now,
    };

    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updatedRecord : r)),
      versionHistories: [...state.versionHistories, newVersion],
    }));
  },

  rollbackRecord: (recordId, versionId, operator, reason) => {
    const state = get();
    const version = state.versionHistories.find((v) => v.id === versionId);
    if (!version) return;

    const now = new Date().toISOString();
    const rolledBackRecord: CableRecord = {
      ...version.snapshot,
      updatedAt: now,
      status: 'manual',
    };

    const existingVersions = state.versionHistories.filter((v) => v.recordId === recordId);
    const newVersion: VersionHistory = {
      id: generateId(),
      recordId,
      version: existingVersions.length + 1,
      snapshot: rolledBackRecord,
      operator,
      operation: 'rollback',
      reason,
      createdAt: now,
    };

    set((state) => ({
      records: state.records.map((r) => (r.id === recordId ? rolledBackRecord : r)),
      versionHistories: [...state.versionHistories, newVersion],
    }));
  },

  deleteRecord: (id, operator, reason) => {
    const now = new Date().toISOString();
    const state = get();
    const record = state.records.find((r) => r.id === id);
    if (!record) return;

    const existingVersions = state.versionHistories.filter((v) => v.recordId === id);
    const newVersion: VersionHistory = {
      id: generateId(),
      recordId: id,
      version: existingVersions.length + 1,
      snapshot: record,
      operator,
      operation: 'delete',
      reason,
      createdAt: now,
    };

    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
      versionHistories: [...state.versionHistories, newVersion],
    }));
  },

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  toggleRecordSelection: (id) =>
    set((state) => ({
      selectedRecordIds: state.selectedRecordIds.includes(id)
        ? state.selectedRecordIds.filter((i) => i !== id)
        : [...state.selectedRecordIds, id],
    })),

  clearSelection: () => set({ selectedRecordIds: [] }),

  batchUpdateStatus: (ids, status, operator) => {
    ids.forEach((id) => {
      get().updateRecord(id, { status }, operator, `批量更新状态为${status}`);
    });
  },

  importRecords: (incoming, source, operator) => {
    const state = get();
    const conflicts = detectDuplicates(incoming, state.records, source);
    let added = 0;
    let skipped = 0;

    const now = new Date().toISOString();
    const newRecords: CableRecord[] = [];
    const newVersions: VersionHistory[] = [];

    incoming.forEach((row, index) => {
      const conflict = conflicts.find((c) => c.rowIndex === index);
      if (conflict && !conflict.resolved) {
        skipped++;
        return;
      }

      if (conflict?.resolved && conflict.resolution === 'skip') {
        skipped++;
        return;
      }

      if (conflict?.resolved && conflict.resolution === 'overwrite' && conflict.existingRecord) {
        const updates: Partial<CableRecord> = {
          startPoint: row.startPoint,
          endPoint: row.endPoint,
          remark: row.remark || conflict.existingRecord.remark,
          status: 'manual',
        };
        get().updateRecord(conflict.existingRecord.id, updates, operator, '导入覆盖');
        added++;
        return;
      }

      if (conflict?.resolved && conflict.resolution === 'fix_flipped' && row.startPoint && row.endPoint) {
        const fixedRecord: Partial<CableRecord> = {
          ...row,
          startPoint: flipBothCoordinates(row.startPoint),
          endPoint: flipBothCoordinates(row.endPoint),
          coordinatesFlipped: true,
        };
        if (conflict.existingRecord) {
          get().updateRecord(conflict.existingRecord.id, fixedRecord, operator, '修正翻转坐标');
        } else {
          const newRec: CableRecord = {
            id: generateId(),
            cableNo: row.cableNo || '',
            room: row.room || '',
            cabinet: row.cabinet || '',
            startPoint: fixedRecord.startPoint!,
            endPoint: fixedRecord.endPoint!,
            cableType: row.cableType || '',
            status: 'pending',
            sourceId: source.id,
            ownerId: operator === '张伟' ? 'p001' : 'p002',
            remark: row.remark || '',
            createdAt: now,
            updatedAt: now,
            coordinatesFlipped: true,
          };
          newRecords.push(newRec);
          newVersions.push({
            id: generateId(),
            recordId: newRec.id,
            version: 1,
            snapshot: newRec,
            operator,
            operation: 'import',
            reason: '导入时自动修正翻转坐标',
            createdAt: now,
          });
        }
        added++;
        return;
      }

      if (conflict?.resolved && conflict.resolution === 'merge' && conflict.existingRecord) {
        const updates: Partial<CableRecord> = {
          remark: `${conflict.existingRecord.remark}\n${row.remark}`.trim(),
          status: 'manual',
        };
        get().updateRecord(conflict.existingRecord.id, updates, operator, '合并记录');
        added++;
        return;
      }

      if (!row.cableNo || !row.room || !row.cabinet || !row.startPoint || !row.endPoint) {
        skipped++;
        return;
      }

      const newRecord: CableRecord = {
        id: generateId(),
        cableNo: row.cableNo,
        room: row.room,
        cabinet: row.cabinet,
        startPoint: row.startPoint,
        endPoint: row.endPoint,
        cableType: row.cableType || '',
        status: 'pending',
        sourceId: source.id,
        ownerId: operator === '张伟' ? 'p001' : 'p002',
        remark: row.remark || '',
        createdAt: now,
        updatedAt: now,
        coordinatesFlipped: false,
      };

      newRecords.push(newRecord);
      newVersions.push({
        id: generateId(),
        recordId: newRecord.id,
        version: 1,
        snapshot: newRecord,
        operator,
        operation: 'import',
        reason: '数据导入',
        createdAt: now,
      });
      added++;
    });

    set((state) => ({
      records: [...state.records, ...newRecords],
      versionHistories: [...state.versionHistories, ...newVersions],
      conflicts: [],
    }));

    return { conflicts, added, skipped };
  },

  resolveConflict: (conflictIndex, action, operator) => {
    set((state) => {
      const newConflicts = [...state.conflicts];
      if (newConflicts[conflictIndex]) {
        newConflicts[conflictIndex] = {
          ...newConflicts[conflictIndex],
          resolved: true,
          resolution: action,
        };
      }
      return { conflicts: newConflicts };
    });
  },

  resolveAllConflicts: (defaultAction, operator) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) => ({
        ...c,
        resolved: true,
        resolution: defaultAction,
      })),
    }));
  },

  detectImportConflicts: (incoming, source) => {
    const state = get();
    const conflicts = detectDuplicates(incoming, state.records, source);
    set({ conflicts });
    return conflicts;
  },

  getRecordVersions: (recordId) => {
    return get()
      .versionHistories.filter((v) => v.recordId === recordId)
      .sort((a, b) => b.version - a.version);
  },

  getFilteredRecords: () => {
    const state = get();
    const { filters, records } = state;

    return records.filter((record) => {
      if (filters.rooms.length > 0 && !filters.rooms.includes(record.room)) return false;
      if (filters.cabinets.length > 0 && !filters.cabinets.includes(record.cabinet)) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(record.status)) return false;
      if (filters.cableTypes.length > 0 && !filters.cableTypes.includes(record.cableType)) return false;

      const source = state.getSourceById(record.sourceId);
      if (filters.sourceTypes.length > 0 && source && !filters.sourceTypes.includes(source.type)) return false;

      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        return (
          record.cableNo.toLowerCase().includes(search) ||
          record.room.toLowerCase().includes(search) ||
          record.cabinet.toLowerCase().includes(search) ||
          record.remark.toLowerCase().includes(search)
        );
      }

      if (filters.dateRange) {
        const recordDate = new Date(record.createdAt);
        const start = new Date(filters.dateRange.start);
        const end = new Date(filters.dateRange.end);
        if (recordDate < start || recordDate > end) return false;
      }

      return true;
    });
  },

  getSourceById: (id) => get().dataSources.find((s) => s.id === id),

  getPersonById: (id) => get().persons.find((p) => p.id === id),

  setConflicts: (conflicts) => set({ conflicts }),
}));
