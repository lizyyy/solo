import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ShortageRecord,
  ContractSnapshot,
  ChangeLog,
  TrackAlias,
  RecordStatus,
  ParsedContractLine
} from '@/types';
import { mockRecords, mockSnapshots, mockChangeLogs, mockAliases } from '@/data/mockRecords';
import { generateId } from '@/utils/hash';
import { diffRecords, createChangeLogs } from '@/utils/changeTracker';
import { detectBoundaryCase, getNextStatusAfterBoundaryCheck } from '@/utils/boundaryRules';
import { filterDuplicateLines } from '@/utils/deduplication';

interface AppState {
  currentUser: { name: string; role: 'music_teacher' | 'tour_coordinator' | 'operator' };
  setCurrentUser: (user: { name: string; role: 'music_teacher' | 'tour_coordinator' | 'operator' }) => void;

  records: ShortageRecord[];
  snapshots: ContractSnapshot[];
  changeLogs: ChangeLog[];
  aliases: TrackAlias[];

  addRecords: (lines: ParsedContractLine[], snapshotId: string, operator: string) => void;
  updateRecord: (id: string, updates: Partial<ShortageRecord>, operator: string, reason?: string) => void;
  updateRecordStatus: (id: string, status: RecordStatus, operator: string, reason?: string) => void;
  matchAliasForRecord: (recordId: string, standardName: string, operator: string) => void;
  addAlias: (standardName: string, aliasName: string, operator: string) => void;
  deleteAlias: (aliasId: string) => void;
  addSnapshot: (snapshot: Omit<ContractSnapshot, 'id' | 'uploadedAt'>) => ContractSnapshot;
  importContractLines: (lines: ParsedContractLine[], fileName: string, operator: string) => { newCount: number; duplicateCount: number };

  getRecordById: (id: string) => ShortageRecord | undefined;
  getChangeLogsForRecord: (recordId: string) => ChangeLog[];
  getAliasesForStandard: (standardName: string) => TrackAlias[];
  getStandardNameForAlias: (aliasName: string) => string | undefined;

  resetToMockData: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: { name: '许老师', role: 'music_teacher' },
      setCurrentUser: (user) => set({ currentUser: user }),

      records: mockRecords,
      snapshots: mockSnapshots,
      changeLogs: mockChangeLogs,
      aliases: mockAliases,

      addRecords: (lines, snapshotId, operator) => {
        const now = new Date().toISOString();
        const newRecords: ShortageRecord[] = lines.map((line, idx) => {
          const baseRecord: Partial<ShortageRecord> = {
            id: generateId(),
            snapshotId,
            originalLineNumber: line.lineNumber,
            originalContent: line.content,
            trackName: line.trackName,
            shortageQuantity: line.quantity,
            status: 'pending',
            currentNote: '',
            isBoundaryCase: false,
            createdAt: now,
            updatedAt: now
          };

          const boundaryResult = detectBoundaryCase(baseRecord, get().records);
          return {
            ...baseRecord,
            isBoundaryCase: boundaryResult.isBoundary,
            boundaryType: boundaryResult.boundaryType,
            status: boundaryResult.isBoundary ? 'review_needed' : 'pending'
          } as ShortageRecord;
        });

        const initialLogs: ChangeLog[] = newRecords.flatMap(r => [
          {
            id: generateId(),
            recordId: r.id,
            fieldName: 'status',
            oldValue: '',
            newValue: r.status,
            operator,
            changedAt: now,
            changeReason: '合同页截图导入'
          }
        ]);

        set(state => ({
          records: [...state.records, ...newRecords],
          changeLogs: [...state.changeLogs, ...initialLogs]
        }));
      },

      updateRecord: (id, updates, operator, reason = '') => {
        const oldRecord = get().records.find(r => r.id === id);
        if (!oldRecord) return;

        const newRecord = { ...oldRecord, ...updates, updatedAt: new Date().toISOString() };
        const diffs = diffRecords(oldRecord, newRecord);

        if (diffs.length === 0) return;

        const logs = createChangeLogs(id, diffs, operator, reason);

        set(state => ({
          records: state.records.map(r => r.id === id ? newRecord : r),
          changeLogs: [...state.changeLogs, ...logs]
        }));
      },

      updateRecordStatus: (id, status, operator, reason = '') => {
        const oldRecord = get().records.find(r => r.id === id);
        if (!oldRecord) return;

        if (status === 'confirmed') {
          const boundaryResult = detectBoundaryCase(oldRecord, get().records);
          if (boundaryResult.isBoundary) {
            status = 'review_needed' as RecordStatus;
            reason = reason || '检测到边界场景，需巡演统筹复核';
          }
        }

        get().updateRecord(id, { status }, operator, reason);
      },

      matchAliasForRecord: (recordId, standardName, operator) => {
        const record = get().records.find(r => r.id === recordId);
        if (!record) return;

        const updates: Partial<ShortageRecord> = {
          standardTrackName: standardName,
          status: 'alias_mapped'
        };

        const boundaryResult = detectBoundaryCase({ ...record, ...updates }, get().records);
        if (boundaryResult.isBoundary) {
          updates.status = 'review_needed';
          updates.isBoundaryCase = true;
          updates.boundaryType = boundaryResult.boundaryType;
        }

        get().updateRecord(recordId, updates, operator, '补看曲目别名表后更新');
      },

      addAlias: (standardName, aliasName, operator) => {
        const newAlias: TrackAlias = {
          id: generateId(),
          standardName,
          aliasName,
          addedAt: new Date().toISOString(),
          addedBy: operator
        };
        set(state => ({
          aliases: [...state.aliases, newAlias]
        }));
      },

      deleteAlias: (aliasId) => {
        set(state => ({
          aliases: state.aliases.filter(a => a.id !== aliasId)
        }));
      },

      addSnapshot: (snapshot) => {
        const newSnapshot: ContractSnapshot = {
          ...snapshot,
          id: generateId(),
          uploadedAt: new Date().toISOString()
        };
        set(state => ({
          snapshots: [...state.snapshots, newSnapshot]
        }));
        return newSnapshot;
      },

      importContractLines: (lines, fileName, operator) => {
        const { newLines, duplicates } = filterDuplicateLines(lines, get().records);

        const snapshot = get().addSnapshot({
          fileHash: `mock-${Date.now()}`,
          fileName,
          uploadedBy: operator,
          contentFingerprint: `fp-${Date.now()}`
        });

        if (newLines.length > 0) {
          get().addRecords(newLines, snapshot.id, operator);
        }

        return { newCount: newLines.length, duplicateCount: duplicates.length };
      },

      getRecordById: (id) => get().records.find(r => r.id === id),

      getChangeLogsForRecord: (recordId) =>
        get().changeLogs.filter(l => l.recordId === recordId).sort((a, b) =>
          new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
        ),

      getAliasesForStandard: (standardName) =>
        get().aliases.filter(a => a.standardName === standardName),

      getStandardNameForAlias: (aliasName) => {
        const alias = get().aliases.find(a => a.aliasName === aliasName);
        return alias?.standardName;
      },

      resetToMockData: () => {
        set({
          records: mockRecords,
          snapshots: mockSnapshots,
          changeLogs: mockChangeLogs,
          aliases: mockAliases
        });
      }
    }),
    {
      name: 'vinyl-shortage-store',
      partialize: (state) => ({
        records: state.records,
        snapshots: state.snapshots,
        changeLogs: state.changeLogs,
        aliases: state.aliases,
        currentUser: state.currentUser
      })
    }
  )
);
