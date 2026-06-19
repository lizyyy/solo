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
import { diffRecords, createChangeLogs, getFieldDisplayName } from '@/utils/changeTracker';
import { detectBoundaryCase, getNextStatusAfterBoundaryCheck } from '@/utils/boundaryRules';
import { classifyImportLines, ClassifiedImportResult, ClassifiedImportLine } from '@/utils/deduplication';

export interface ImportExecutionResult {
  reused: number;
  modified: number;
  added: number;
  details: ClassifiedImportResult;
  modifiedRecordIds: string[];
  addedRecordIds: string[];
}

interface AppState {
  currentUser: { name: string; role: 'music_teacher' | 'tour_coordinator' | 'operator' };
  setCurrentUser: (user: { name: string; role: 'music_teacher' | 'tour_coordinator' | 'operator' }) => void;

  records: ShortageRecord[];
  snapshots: ContractSnapshot[];
  changeLogs: ChangeLog[];
  aliases: TrackAlias[];

  addRecords: (lines: ParsedContractLine[], snapshotId: string, operator: string) => string[];
  updateRecord: (id: string, updates: Partial<ShortageRecord>, operator: string, reason?: string) => void;
  updateRecordStatus: (id: string, status: RecordStatus, operator: string, reason?: string) => void;
  matchAliasForRecord: (recordId: string, standardName: string, operator: string) => void;
  addAlias: (standardName: string, aliasName: string, operator: string) => void;
  deleteAlias: (aliasId: string) => void;
  addSnapshot: (snapshot: Omit<ContractSnapshot, 'id' | 'uploadedAt'>) => ContractSnapshot;

  previewImport: (lines: ParsedContractLine[]) => ClassifiedImportResult;
  importContractLines: (lines: ParsedContractLine[], fileName: string, operator: string) => ImportExecutionResult;

  rollbackRecordToChange: (recordId: string, changeLogId: string, operator: string, reason?: string) => boolean;
  rollbackFieldChange: (recordId: string, changeLogId: string, operator: string, reason?: string) => boolean;

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
        const newIds: string[] = [];
        const newRecords: ShortageRecord[] = lines.map((line) => {
          const id = generateId();
          newIds.push(id);
          const baseRecord: Partial<ShortageRecord> = {
            id,
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
            fieldName: 'originalLineNumber',
            oldValue: '',
            newValue: String(r.originalLineNumber),
            operator,
            changedAt: now,
            changeReason: '合同页截图导入（首次新增）'
          },
          {
            id: generateId(),
            recordId: r.id,
            fieldName: 'originalContent',
            oldValue: '',
            newValue: r.originalContent,
            operator,
            changedAt: now,
            changeReason: '合同页截图导入（首次新增）'
          },
          {
            id: generateId(),
            recordId: r.id,
            fieldName: 'shortageQuantity',
            oldValue: '',
            newValue: String(r.shortageQuantity),
            operator,
            changedAt: now,
            changeReason: '合同页截图导入（首次新增）'
          },
          {
            id: generateId(),
            recordId: r.id,
            fieldName: 'currentNote',
            oldValue: '',
            newValue: r.currentNote || '',
            operator,
            changedAt: now,
            changeReason: '合同页截图导入（首次新增）'
          },
          {
            id: generateId(),
            recordId: r.id,
            fieldName: 'status',
            oldValue: '',
            newValue: r.status,
            operator,
            changedAt: now,
            changeReason: '合同页截图导入（首次新增）'
          }
        ]);

        set(state => ({
          records: [...state.records, ...newRecords],
          changeLogs: [...state.changeLogs, ...initialLogs]
        }));
        return newIds;
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

      previewImport: (lines) => {
        return classifyImportLines(lines, get().records);
      },

      importContractLines: (lines, fileName, operator) => {
        const now = new Date().toISOString();
        const classified = classifyImportLines(lines, get().records);

        get().addSnapshot({
          fileHash: `mock-${Date.now()}`,
          fileName,
          uploadedBy: operator,
          contentFingerprint: `fp-${Date.now()}`
        });

        const modifiedRecordIds: string[] = [];
        for (const item of classified.modified) {
          if (!item.existingRecordId) continue;
          const record = get().records.find(r => r.id === item.existingRecordId);
          if (!record) continue;

          const updates: Partial<ShortageRecord> = {};
          const fieldReasonMap: Record<string, string> = {};

          for (const change of item.changedFields || []) {
            fieldReasonMap[change.field] = `合同页截图重复导入时发现变更（原行号 ${item.line.lineNumber}）`;
            if (change.field === 'shortageQuantity') {
              updates.shortageQuantity = parseInt(change.newValue, 10) || 0;
            } else if (change.field === 'trackName') {
              updates.trackName = change.newValue;
            } else if (change.field === 'originalContent') {
              updates.originalContent = change.newValue;
            }
          }

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = now;
            const oldRecord = record;
            const newRecord = { ...oldRecord, ...updates };
            const diffs = diffRecords(oldRecord, newRecord);

            if (diffs.length > 0) {
              const logs = createChangeLogs(
                record.id,
                diffs,
                operator,
                `合同页截图重新导入，${item.line.lineNumber}行内容/数量变更，自动同步`
              );

              const boundaryResult = detectBoundaryCase(newRecord, get().records);
              if (boundaryResult.isBoundary && !newRecord.isBoundaryCase) {
                updates.isBoundaryCase = true;
                updates.boundaryType = boundaryResult.boundaryType;
                updates.status = 'review_needed';
              }

              set(state => ({
                records: state.records.map(r => r.id === record.id ? { ...r, ...updates } : r),
                changeLogs: [...state.changeLogs, ...logs]
              }));
              modifiedRecordIds.push(record.id);
            }
          }
        }

        const addedIds: string[] = [];
        if (classified.added.length > 0) {
          const snapshot = get().snapshots[get().snapshots.length - 1];
          const ids = get().addRecords(classified.added.map(c => c.line), snapshot.id, operator);
          addedIds.push(...ids);
        }

        return {
          reused: classified.reused.length,
          modified: classified.modified.length,
          added: classified.added.length,
          details: classified,
          modifiedRecordIds,
          addedRecordIds: addedIds
        };
      },

      rollbackRecordToChange: (recordId, changeLogId, operator, reason = '') => {
        const logs = get().changeLogs
          .filter(l => l.recordId === recordId)
          .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

        const targetIdx = logs.findIndex(l => l.id === changeLogId);
        if (targetIdx === -1) return false;

        const currentRecord = get().records.find(r => r.id === recordId);
        if (!currentRecord) return false;

        const targetLog = logs[targetIdx];
        const rollbackPointTime = targetLog.changedAt;

        const updates: Partial<ShortageRecord> = {};
        const appliedFieldLogs = new Map<string, ChangeLog>();

        for (let i = 0; i <= targetIdx; i++) {
          const log = logs[i];
          appliedFieldLogs.set(log.fieldName, log);
        }

        const fieldReconstruct: Record<string, string> = {};
        appliedFieldLogs.forEach((log, field) => {
          fieldReconstruct[field] = log.newValue;
        });

        const now = new Date().toISOString();
        const actualDiffs: Array<{ fieldName: string; oldValue: string; newValue: string }> = [];

        for (const field of Object.keys(fieldReconstruct)) {
          let currentVal = String((currentRecord as any)[field] ?? '');
          let targetVal = fieldReconstruct[field];

          if (field === 'shortageQuantity') {
            currentVal = String(currentRecord.shortageQuantity);
          }
          if (field === 'isBoundaryCase') {
            currentVal = currentRecord.isBoundaryCase ? 'true' : 'false';
          }

          if (currentVal !== targetVal) {
            actualDiffs.push({ fieldName: field, oldValue: currentVal, newValue: targetVal });
            if (field === 'shortageQuantity') {
              updates.shortageQuantity = parseInt(targetVal, 10) || 0;
            } else if (field === 'isBoundaryCase') {
              updates.isBoundaryCase = targetVal === 'true';
            } else if (field === 'status') {
              updates.status = targetVal as RecordStatus;
            } else {
              (updates as any)[field] = targetVal;
            }
          }
        }

        if (actualDiffs.length === 0) return false;

        const newRecord = { ...currentRecord, ...updates, updatedAt: now } as ShortageRecord;

        const rollbackLogs: ChangeLog[] = actualDiffs.map(d => ({
          id: generateId(),
          recordId,
          fieldName: d.fieldName,
          oldValue: d.oldValue,
          newValue: d.newValue,
          operator,
          changedAt: now,
          changeReason: reason || `回滚：恢复到变更前状态（参考变更日志 ${changeLogId.slice(0, 8)}）`
        }));

        set(state => ({
          records: state.records.map(r => r.id === recordId ? newRecord : r),
          changeLogs: [...state.changeLogs, ...rollbackLogs]
        }));
        return true;
      },

      rollbackFieldChange: (recordId, changeLogId, operator, reason = '') => {
        const log = get().changeLogs.find(l => l.id === changeLogId && l.recordId === recordId);
        if (!log) return false;

        const currentRecord = get().records.find(r => r.id === recordId);
        if (!currentRecord) return false;

        const now = new Date().toISOString();
        const updates: Partial<ShortageRecord> = {};
        const field = log.fieldName as keyof ShortageRecord;

        let currentVal = String((currentRecord as any)[field] ?? '');
        const targetVal = log.oldValue;

        if (field === 'shortageQuantity') {
          currentVal = String(currentRecord.shortageQuantity);
        }
        if (field === 'isBoundaryCase') {
          currentVal = currentRecord.isBoundaryCase ? 'true' : 'false';
        }

        if (currentVal === targetVal) return false;

        if (field === 'shortageQuantity') {
          updates.shortageQuantity = parseInt(targetVal, 10) || 0;
        } else if (field === 'isBoundaryCase') {
          updates.isBoundaryCase = targetVal === 'true';
        } else if (field === 'status') {
          updates.status = targetVal as RecordStatus;
        } else {
          (updates as any)[field] = targetVal;
        }

        const newRecord = { ...currentRecord, ...updates, updatedAt: now } as ShortageRecord;

        const rollbackLog: ChangeLog = {
          id: generateId(),
          recordId,
          fieldName: log.fieldName,
          oldValue: currentVal,
          newValue: targetVal,
          operator,
          changedAt: now,
          changeReason: reason || `单字段回滚：${getFieldDisplayName(log.fieldName)} 恢复到变更前（日志 ${changeLogId.slice(0, 8)}）`
        };

        set(state => ({
          records: state.records.map(r => r.id === recordId ? newRecord : r),
          changeLogs: [...state.changeLogs, rollbackLog]
        }));
        return true;
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
