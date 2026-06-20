import { create } from 'zustand';
import type { 
  ApprovalRecord, 
  HistoryEntry, 
  RecordStatus, 
  StepNumber,
  SamplingPoint,
  Summary,
  UserRole,
  ExportLog,
  ExportFormat,
} from '@/types';
import { STATUS_LABELS } from '@/types';
import { mockRecords, mockHistory } from '@/data/mockRecords';
import {
  persistToLocalStorage,
  restoreFromLocalStorage,
  clearPersistedState,
} from '@/utils/persistStore';

const generateId = () => Math.random().toString(36).substring(2, 9);
const generateBatchId = () => `BATCH-${Date.now().toString(36).toUpperCase()}`;

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const calculateHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

const stripSnapshot = <T extends { _snapshot?: unknown }>(obj: T): T => {
  const cloned = deepClone(obj);
  delete (cloned as { _snapshot?: unknown })._snapshot;
  return cloned;
};

interface ImportPreviewItem {
  originalLineNumber: number;
  communityOldName?: string;
  communityNewName?: string;
  rampExists: boolean;
  rampLocation: string;
  rampCondition: string;
}

interface AppState {
  records: ApprovalRecord[];
  history: Record<string, HistoryEntry[]>;
  exportLogs: ExportLog[];
  currentUser: { name: string; role: UserRole };
  
  getRecordById: (id: string) => ApprovalRecord | undefined;
  getHistoryByRecordId: (id: string) => HistoryEntry[];
  getExportLogById: (id: string) => ExportLog | undefined;
  
  switchUser: (name: string, role: UserRole) => void;
  
  importBatchRecords: (items: ImportPreviewItem[]) => { 
    batchId: string; 
    newRecordIds: string[];
    conflictCount: number;
  };
  
  addSamplingPoint: (recordId: string, sampling: SamplingPoint) => boolean;
  updateSummary: (recordId: string, summary: Summary) => boolean;
  confirmFinalName: (recordId: string, finalName: string) => boolean;
  updateRecordStatus: (recordId: string, status: RecordStatus, remark?: string) => boolean;
  setCurrentStep: (recordId: string, step: StepNumber) => boolean;
  
  rollbackToHistory: (recordId: string, historyId: string) => { success: boolean; message: string };
  rollbackExportToSnapshot: (exportLogId: string) => { success: boolean; message: string };
  
  createExportLog: (
    format: ExportFormat,
    filename: string,
    records: ApprovalRecord[],
    consistencyVerified: boolean,
    consistencyHash: string
  ) => ExportLog;
  
  calculateRecordsHash: (records: ApprovalRecord[]) => string;
  calculateConsistencyHash: () => string;

  resetAllRecords: () => void;
  clearPersistenceAndUseDefault: () => void;
}

const buildInitialState = () => {
  const restored = restoreFromLocalStorage();
  if (restored && (restored.records as unknown[]).length > 0) {
    return {
      records: restored.records as ApprovalRecord[],
      history: restored.history as Record<string, HistoryEntry[]>,
      exportLogs: restored.exportLogs as ExportLog[],
      currentUser: restored.currentUser as { name: string; role: UserRole },
    };
  }
  return {
    records: deepClone(mockRecords),
    history: deepClone(mockHistory),
    exportLogs: [],
    currentUser: { name: '阿宁', role: 'aning' as UserRole },
  };
};

const initialState = buildInitialState();

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  getRecordById: (id) => get().records.find(r => r.id === id),
  getHistoryByRecordId: (id) => get().history[id] || [],
  getExportLogById: (id) => get().exportLogs.find(e => e.id === id),

  switchUser: (name, role) => {
    set({ currentUser: { name, role } });
  },

  importBatchRecords: (items) => {
    const { records: existingRecords, history: existingHistory, currentUser } = get();
    const batchId = generateBatchId();
    const now = new Date();
    
    const maxIdNum = existingRecords.reduce((max, r) => {
      const num = parseInt(r.id.replace('rec-', ''));
      return num > max ? num : max;
    }, 0);

    const nameAddressMap = new Map<string, number[]>();
    items.forEach((item, idx) => {
      const key = `${item.communityOldName || ''}|${item.communityNewName || ''}`;
      const lineNum = item.originalLineNumber;
      const existing = nameAddressMap.get(key) || [];
      nameAddressMap.set(key, [...existing, lineNum]);
    });

    const conflictLineNums = new Set<number>();
    nameAddressMap.forEach((lines) => {
      if (lines.length >= 2) {
        lines.forEach(l => conflictLineNums.add(l));
      }
    });

    const newRecords: ApprovalRecord[] = [];
    const newHistoryEntries: Record<string, HistoryEntry[]> = {};
    let conflictCount = 0;

    items.forEach((item, idx) => {
      const hasNameConflict = 
        conflictLineNums.has(item.originalLineNumber) || 
        (!!item.communityOldName && !!item.communityNewName && item.communityOldName !== item.communityNewName);
      
      if (hasNameConflict) conflictCount++;

      const recordId = `rec-${String(maxIdNum + idx + 1).padStart(3, '0')}`;
      
      const initialStatus: RecordStatus = hasNameConflict ? 'pending_review' : 'imported';

      const record: ApprovalRecord = {
        id: recordId,
        importBatchId: batchId,
        originalLineNumber: item.originalLineNumber,
        communityOldName: item.communityOldName,
        communityNewName: item.communityNewName,
        hasNameConflict,
        rampRecord: {
          exists: item.rampExists,
          location: item.rampLocation,
          condition: item.rampCondition,
          source: 'import',
        },
        status: initialStatus,
        currentStep: 1,
        assignee: hasNameConflict ? 'inspector' : 'aning',
        createdAt: new Date(now.getTime() + idx),
        updatedAt: new Date(now.getTime() + idx),
      };

      newRecords.push(record);

      const createHistory: HistoryEntry = {
        id: `h-${generateId()}`,
        recordId,
        action: 'create',
        operator: currentUser.name,
        operatorRole: currentUser.role,
        timestamp: new Date(now.getTime() + idx),
        snapshotAfter: stripSnapshot(record),
        remark: `第一步：无障碍坡道记录第一次导入（批次 ${batchId}，原始行号 #${item.originalLineNumber}）`,
      };

      const historyList: HistoryEntry[] = [createHistory];

      if (hasNameConflict) {
        const conflictHistory: HistoryEntry = {
          id: `h-${generateId()}`,
          recordId,
          action: 'update_status',
          operator: '系统',
          operatorRole: currentUser.role,
          timestamp: new Date(now.getTime() + idx + 1),
          field: 'status',
          oldValue: 'imported',
          newValue: 'pending_review',
          snapshotBefore: { ...stripSnapshot(record), status: 'imported' as RecordStatus },
          snapshotAfter: stripSnapshot(record),
          remark: '检测到同一小区新旧名称冲突，标记为待巡检员复核，不急着归正常',
        };
        historyList.push(conflictHistory);
      }

      newHistoryEntries[recordId] = historyList;
    });

    set({
      records: [...existingRecords, ...newRecords],
      history: {
        ...existingHistory,
        ...newHistoryEntries,
      },
    });

    return {
      batchId,
      newRecordIds: newRecords.map(r => r.id),
      conflictCount,
    };
  },

  addSamplingPoint: (recordId, sampling) => {
    const { records, history, currentUser } = get();
    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return false;

    const beforeRecord = stripSnapshot(records[recordIndex]);
    const existingHistory = history[recordId] || [];

    const afterRecord: ApprovalRecord = {
      ...beforeRecord,
      samplingPoint: sampling,
      status: 'sampling_reviewed',
      currentStep: 2,
      assignee: beforeRecord.hasNameConflict ? 'inspector' : 'aning',
      updatedAt: new Date(),
    };

    const samplingHistory: HistoryEntry = {
      id: `h-${generateId()}`,
      recordId,
      action: 'add_sampling',
      operator: currentUser.name,
      operatorRole: currentUser.role,
      timestamp: new Date(),
      field: 'samplingPoint',
      oldValue: beforeRecord.samplingPoint,
      newValue: sampling,
      snapshotBefore: beforeRecord,
      snapshotAfter: afterRecord,
      remark: `第二步：${currentUser.name}补看夜间采样点 → 状态：${STATUS_LABELS['sampling_reviewed']}`,
    };

    const newRecords = [...records];
    newRecords[recordIndex] = afterRecord;

    set({
      records: newRecords,
      history: {
        ...history,
        [recordId]: [...existingHistory, samplingHistory],
      },
    });

    return true;
  },

  updateSummary: (recordId, summary) => {
    const { records, history, currentUser } = get();
    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return false;

    const beforeRecord = stripSnapshot(records[recordIndex]);
    const existingHistory = history[recordId] || [];

    const afterRecord: ApprovalRecord = {
      ...beforeRecord,
      summary,
      status: 'summary_updated',
      currentStep: 3,
      assignee: beforeRecord.hasNameConflict ? 'inspector' : 'street',
      updatedAt: new Date(),
    };

    const summaryHistory: HistoryEntry = {
      id: `h-${generateId()}`,
      recordId,
      action: 'update_summary',
      operator: currentUser.name,
      operatorRole: currentUser.role,
      timestamp: new Date(),
      field: 'summary',
      oldValue: beforeRecord.summary,
      newValue: summary,
      snapshotBefore: beforeRecord,
      snapshotAfter: afterRecord,
      remark: `第三步：更新街道会看摘要 → 状态：${STATUS_LABELS['summary_updated']}`,
    };

    const newRecords = [...records];
    newRecords[recordIndex] = afterRecord;

    set({
      records: newRecords,
      history: {
        ...history,
        [recordId]: [...existingHistory, summaryHistory],
      },
    });

    return true;
  },

  confirmFinalName: (recordId, finalName) => {
    const { records, history, currentUser } = get();
    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return false;

    const beforeRecord = stripSnapshot(records[recordIndex]);
    const existingHistory = history[recordId] || [];

    const afterRecord: ApprovalRecord = {
      ...beforeRecord,
      communityFinalName: finalName,
      updatedAt: new Date(),
    };

    if (afterRecord.status === 'pending_review' && afterRecord.currentStep >= 3) {
      afterRecord.status = 'completed';
    }

    const confirmHistory: HistoryEntry = {
      id: `h-${generateId()}`,
      recordId,
      action: 'confirm_name',
      operator: currentUser.name,
      operatorRole: 'inspector',
      timestamp: new Date(),
      field: 'communityFinalName',
      oldValue: beforeRecord.communityFinalName,
      newValue: finalName,
      snapshotBefore: beforeRecord,
      snapshotAfter: afterRecord,
      remark: `巡检员确认最终名称为「${finalName}」，旧称「${beforeRecord.communityOldName || '无'}」新称「${beforeRecord.communityNewName || '无'}」`,
    };

    const newRecords = [...records];
    newRecords[recordIndex] = afterRecord;

    set({
      records: newRecords,
      history: {
        ...history,
        [recordId]: [...existingHistory, confirmHistory],
      },
    });

    return true;
  },

  updateRecordStatus: (recordId, status, remark) => {
    const { records, history, currentUser } = get();
    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return false;

    const beforeRecord = stripSnapshot(records[recordIndex]);
    const existingHistory = history[recordId] || [];
    const oldStatus = beforeRecord.status;

    const afterRecord: ApprovalRecord = {
      ...beforeRecord,
      status,
      updatedAt: new Date(),
    };

    const statusHistory: HistoryEntry = {
      id: `h-${generateId()}`,
      recordId,
      action: 'update_status',
      operator: currentUser.name,
      operatorRole: currentUser.role,
      timestamp: new Date(),
      field: 'status',
      oldValue: oldStatus,
      newValue: status,
      snapshotBefore: beforeRecord,
      snapshotAfter: afterRecord,
      remark: remark || `状态变更：${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[status]}`,
    };

    const newRecords = [...records];
    newRecords[recordIndex] = afterRecord;

    set({
      records: newRecords,
      history: {
        ...history,
        [recordId]: [...existingHistory, statusHistory],
      },
    });

    return true;
  },

  setCurrentStep: (recordId, step) => {
    const { records } = get();
    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return false;

    const newRecords = [...records];
    newRecords[recordIndex] = {
      ...stripSnapshot(newRecords[recordIndex]),
      currentStep: step,
      updatedAt: new Date(),
    };

    set({ records: newRecords });
    return true;
  },

  rollbackToHistory: (recordId, historyId) => {
    const { records, history, currentUser } = get();
    const recordHistory = history[recordId];
    if (!recordHistory) return { success: false, message: '找不到该记录的操作历史' };

    const targetEntry = recordHistory.find(h => h.id === historyId);
    if (!targetEntry) return { success: false, message: '找不到指定的历史操作' };

    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return { success: false, message: '找不到审批记录' };

    const beforeRollback = stripSnapshot(records[recordIndex]);
    const restoredSnapshot = targetEntry.snapshotBefore 
      ? deepClone(targetEntry.snapshotBefore) 
      : (targetEntry.snapshotAfter ? deepClone(targetEntry.snapshotAfter) : null);

    if (!restoredSnapshot) {
      return { success: false, message: '该历史操作没有保存完整快照，无法精确回滚' };
    }

    const restoredRecord: ApprovalRecord = {
      ...restoredSnapshot,
      updatedAt: new Date(),
    };

    const rollbackHistory: HistoryEntry = {
      id: `h-${generateId()}`,
      recordId,
      action: 'rollback',
      operator: currentUser.name,
      operatorRole: currentUser.role,
      timestamp: new Date(),
      snapshotBefore: beforeRollback,
      snapshotAfter: stripSnapshot(restoredRecord),
      remark: `回滚到操作 [${targetEntry.action}] ${targetEntry.remark || ''} — 无障碍坡道记录、名称、状态、采样点、摘要均回到该操作之前的可解释结果`,
    };

    const newRecords = [...records];
    newRecords[recordIndex] = restoredRecord;

    set({
      records: newRecords,
      history: {
        ...history,
        [recordId]: [...recordHistory, rollbackHistory],
      },
    });

    return { 
      success: true, 
      message: `回滚成功：已回到「${targetEntry.remark || targetEntry.action}」之前的状态，包括无障碍坡道记录在内的所有字段均已恢复` 
    };
  },

  rollbackExportToSnapshot: (exportLogId) => {
    const { exportLogs, records, history, currentUser } = get();
    const exportLog = exportLogs.find(e => e.id === exportLogId);
    if (!exportLog) return { success: false, message: '找不到导出日志' };

    const snapshotRecords = exportLog.dataSnapshot;
    const now = new Date();
    const newHistory = { ...history };

    const updatedRecords = records.map(currentRecord => {
      const snapshot = snapshotRecords.find(s => s.id === currentRecord.id);
      if (!snapshot) return currentRecord;

      const beforeRollback = stripSnapshot(currentRecord);
      const restoredRecord = {
        ...deepClone(snapshot),
        updatedAt: now,
      };

      const rollbackEntry: HistoryEntry = {
        id: `h-${generateId()}`,
        recordId: currentRecord.id,
        action: 'rollback',
        operator: currentUser.name,
        operatorRole: currentUser.role,
        timestamp: now,
        snapshotBefore: beforeRollback,
        snapshotAfter: stripSnapshot(restoredRecord),
        remark: `从导出明细（${exportLog.filename}）回滚到导出时的数据快照，保证追回原始材料时结果一致`,
      };

      newHistory[currentRecord.id] = [
        ...(newHistory[currentRecord.id] || []),
        rollbackEntry,
      ];

      return restoredRecord;
    });

    set({
      records: updatedRecords,
      history: newHistory,
    });

    return {
      success: true,
      message: `已从「${exportLog.filename}」的导出快照回滚 ${snapshotRecords.length} 条记录，无障碍坡道记录与导出明细完全一致`,
    };
  },

  createExportLog: (format, filename, records, consistencyVerified, consistencyHash) => {
    const { exportLogs, currentUser } = get();
    const snapshot = records.map(r => stripSnapshot(r));
    const dataHash = get().calculateRecordsHash(snapshot);

    const log: ExportLog = {
      id: `exp-${generateId()}`,
      format,
      filename,
      exportedBy: currentUser.name,
      exportedByRole: currentUser.role,
      exportedAt: new Date(),
      recordCount: records.length,
      recordIds: records.map(r => r.id),
      dataSnapshotHash: dataHash,
      dataSnapshot: snapshot,
      consistencyVerified,
      consistencyHash,
    };

    set({ exportLogs: [log, ...exportLogs] });
    return log;
  },

  calculateRecordsHash: (records) => {
    const serializable = records.map(r => stripSnapshot(r));
    return calculateHash(JSON.stringify(serializable));
  },

  calculateConsistencyHash: () => {
    const { records } = get();
    return get().calculateRecordsHash(records);
  },

  resetAllRecords: () => {
    set({
      records: [],
      history: {},
      exportLogs: [],
    });
  },

  clearPersistenceAndUseDefault: () => {
    clearPersistedState();
    set({
      records: deepClone(mockRecords),
      history: deepClone(mockHistory),
      exportLogs: [],
      currentUser: { name: '阿宁', role: 'aning' },
    });
  },
}));

useAppStore.subscribe((state) => {
  persistToLocalStorage({
    records: state.records,
    history: state.history,
    exportLogs: state.exportLogs,
    currentUser: state.currentUser,
  });
});
