import { create } from 'zustand';
import type {
  TrainingLog,
  ThresholdNote,
  ChangeHistory,
  ImportReport,
  LogStatus,
  WorkflowStep,
} from '@/types';
import { mockTrainingLogs, mockThresholdNotes, mockChangeHistory } from '@/data/mockData';
import { generateId, computeStringHash } from '@/utils/hash';
import { applyBoundaryRules } from '@/utils/boundaryRules';
import { deduplicateLogs } from '@/utils/deduplication';
import { createChangeHistory, snapshotEntity } from '@/utils/changeTracker';

interface AppState {
  trainingLogs: TrainingLog[];
  thresholdNotes: ThresholdNote[];
  changeHistory: ChangeHistory[];
  currentUser: string;
  workflowStep: WorkflowStep;
  lastImportReport: ImportReport | null;
  selectedLogId: string | null;

  setWorkflowStep: (step: WorkflowStep) => void;
  selectLog: (id: string | null) => void;
  importTrainingLogs: (
    logs: Omit<TrainingLog, 'id' | 'fileHash' | 'fileName' | 'createdBy' | 'createdAt' | 'updatedAt' | 'isBoundaryCase' | 'status' | 'remark' | 'boundaryReason'>[],
    fileName: string
  ) => Promise<ImportReport>;
  updateLogStatus: (logId: string, status: LogStatus, remark?: string) => void;
  updateLogRemark: (logId: string, remark: string) => void;
  addThresholdNote: (
    trainingLogIds: string[],
    content: string,
    isLateArrival: boolean
  ) => void;
  rollbackChange: (historyId: string) => void;
  getLogsByNoteId: (noteId: string) => TrainingLog[];
  getHistoryByEntityId: (entityId: string) => ChangeHistory[];
}

export const useAppStore = create<AppState>((set, get) => ({
  trainingLogs: mockTrainingLogs,
  thresholdNotes: mockThresholdNotes,
  changeHistory: mockChangeHistory,
  currentUser: '评测运营-小孟',
  workflowStep: 'import',
  lastImportReport: null,
  selectedLogId: null,

  setWorkflowStep: (step) => set({ workflowStep: step }),
  selectLog: (id) => set({ selectedLogId: id }),

  importTrainingLogs: async (rawLogs, fileName) => {
    const fileContent = rawLogs.map(l => `${l.originalLineNumber}:${l.epoch}`).join('|');
    const fileHash = await computeStringHash(fileContent);
    const now = new Date().toISOString();
    const operator = get().currentUser;

    let logsWithMeta: TrainingLog[] = rawLogs.map((raw) => {
      const baseLog: TrainingLog = {
        ...raw,
        id: generateId(),
        fileHash,
        fileName,
        createdBy: operator,
        status: 'pending',
        isBoundaryCase: false,
        remark: '',
        createdAt: now,
        updatedAt: now,
      };
      const boundaryUpdates = applyBoundaryRules(baseLog);
      return { ...baseLog, ...boundaryUpdates, updatedAt: now };
    });

    const { newEntries, report } = deduplicateLogs(logsWithMeta, get().trainingLogs);

    for (const log of newEntries) {
      const history = createChangeHistory(
        'training_log',
        log.id,
        {},
        snapshotEntity(log),
        'import',
        operator
      );
      set((state) => ({
        changeHistory: [...state.changeHistory, history],
      }));
    }

    set((state) => ({
      trainingLogs: [...state.trainingLogs, ...newEntries],
      lastImportReport: report,
    }));

    return report;
  },

  updateLogStatus: (logId, status, remark) => {
    const operator = get().currentUser;
    const log = get().trainingLogs.find((l) => l.id === logId);
    if (!log) return;

    const beforeSnapshot = snapshotEntity(log);
    const updates: Partial<TrainingLog> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (remark !== undefined) {
      updates.remark = remark;
    }

    const afterLog = { ...log, ...updates };
    const history = createChangeHistory(
      'training_log',
      logId,
      beforeSnapshot,
      snapshotEntity(afterLog),
      'update',
      operator
    );

    set((state) => ({
      trainingLogs: state.trainingLogs.map((l) =>
        l.id === logId ? afterLog : l
      ),
      changeHistory: [...state.changeHistory, history],
    }));
  },

  updateLogRemark: (logId, remark) => {
    const operator = get().currentUser;
    const log = get().trainingLogs.find((l) => l.id === logId);
    if (!log) return;

    const beforeSnapshot = snapshotEntity(log);
    const afterLog = {
      ...log,
      remark,
      updatedAt: new Date().toISOString(),
    };
    const history = createChangeHistory(
      'training_log',
      logId,
      beforeSnapshot,
      snapshotEntity(afterLog),
      'update',
      operator
    );

    set((state) => ({
      trainingLogs: state.trainingLogs.map((l) =>
        l.id === logId ? afterLog : l
      ),
      changeHistory: [...state.changeHistory, history],
    }));
  },

  addThresholdNote: (trainingLogIds, content, isLateArrival) => {
    const operator = get().currentUser;
    const now = new Date().toISOString();
    const note: ThresholdNote = {
      id: generateId(),
      trainingLogIds,
      content,
      isLateArrival,
      createdBy: operator,
      createdAt: now,
    };

    const noteHistory = createChangeHistory(
      'threshold_note',
      note.id,
      {},
      snapshotEntity(note),
      'create',
      operator
    );

    const updatedLogs: TrainingLog[] = [];
    const logHistories: ChangeHistory[] = [];

    for (const logId of trainingLogIds) {
      const log = get().trainingLogs.find((l) => l.id === logId);
      if (!log) continue;

      const beforeSnapshot = snapshotEntity(log);

      if (isLateArrival && log.status === 'confirmed') {
        const updatedLog = {
          ...log,
          remark: log.remark
            ? `${log.remark}\n[晚到笔记] ${content.substring(0, 50)}...`
            : `[晚到笔记] ${content.substring(0, 50)}...`,
          updatedAt: now,
        };
        const logHistory = createChangeHistory(
          'training_log',
          logId,
          beforeSnapshot,
          snapshotEntity(updatedLog),
          'update',
          operator
        );
        updatedLogs.push(updatedLog);
        logHistories.push(logHistory);
      } else {
        const updatedLog = {
          ...log,
          remark: log.remark
            ? `${log.remark}\n[笔记] ${content.substring(0, 50)}...`
            : `[笔记] ${content.substring(0, 50)}...`,
          updatedAt: now,
        };
        const logHistory = createChangeHistory(
          'training_log',
          logId,
          beforeSnapshot,
          snapshotEntity(updatedLog),
          'update',
          operator
        );
        updatedLogs.push(updatedLog);
        logHistories.push(logHistory);
      }
    }

    set((state) => {
      const newLogs = state.trainingLogs.map((l) => {
        const updated = updatedLogs.find((u) => u.id === l.id);
        return updated || l;
      });
      return {
        thresholdNotes: [...state.thresholdNotes, note],
        trainingLogs: newLogs,
        changeHistory: [...state.changeHistory, noteHistory, ...logHistories],
      };
    });
  },

  rollbackChange: (historyId) => {
    const operator = get().currentUser;
    const history = get().changeHistory.find((h) => h.id === historyId);
    if (!history) return;

    const beforeData = history.beforeSnapshot;

    if (history.entityType === 'training_log') {
      const log = get().trainingLogs.find((l) => l.id === history.entityId);
      if (!log) return;

      const beforeSnapshot = snapshotEntity(log);
      const rolledBackLog = {
        ...log,
        ...beforeData,
        updatedAt: new Date().toISOString(),
      };

      const rollbackHistory = createChangeHistory(
        'training_log',
        history.entityId,
        beforeSnapshot,
        snapshotEntity(rolledBackLog),
        'rollback',
        operator
      );

      set((state) => ({
        trainingLogs: state.trainingLogs.map((l) =>
          l.id === history.entityId ? rolledBackLog : l
        ),
        changeHistory: [...state.changeHistory, rollbackHistory],
      }));
    }
  },

  getLogsByNoteId: (noteId) => {
    const note = get().thresholdNotes.find((n) => n.id === noteId);
    if (!note) return [];
    return get().trainingLogs.filter((l) => note.trainingLogIds.includes(l.id));
  },

  getHistoryByEntityId: (entityId) => {
    return get()
      .changeHistory.filter((h) => h.entityId === entityId)
      .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());
  },
}));
