import { create } from 'zustand';
import type { InspectionRecord, ProcessState, AuditLogEntry } from '../../shared/types';
import { ProcessStep } from '../../shared/types';
import { coreService } from '../core/CoreService';
import { AuditLogger } from '../core/AuditLogger';
import { createInitialRecords } from '../core/mockData';

interface AppState {
  records: InspectionRecord[];
  processState: ProcessState;
  logs: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;

  initDemo: () => void;
  runImportDemo: () => Promise<void>;
  runCadDemo: () => Promise<void>;
  runExportDemo: () => Promise<string>;
  runFullDemo: () => Promise<void>;

  updateCadLayerName: (id: string, cadName: string) => void;
  manualCorrect: (id: string, length: number) => void;
  forceRecalculate: (id: string) => void;
  setActiveRecord: (id: string | null) => void;

  getLogsByRecordId: (id: string) => AuditLogEntry[];
  reset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  records: createInitialRecords(),
  processState: {
    currentStep: ProcessStep.NOT_STARTED,
    importCompleted: false,
    cadCompleted: false,
    exportCompleted: false,
    activeRecordId: null,
  },
  logs: [],
  isLoading: false,
  error: null,

  initDemo: () => {
    const records = createInitialRecords();
    coreService.setRecords(records);
    set({ records, logs: [] });
  },

  runImportDemo: async () => {
    set({ isLoading: true, error: null });
    try {
      const records = await coreService.runImportDemo();
      const processState = coreService.getProcessState();
      const logs = AuditLogger.getAllLogs();
      set({ records, processState, logs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  runCadDemo: async () => {
    set({ isLoading: true, error: null });
    try {
      const records = await coreService.runCadDemo();
      const processState = coreService.getProcessState();
      const logs = AuditLogger.getAllLogs();
      set({ records, processState, logs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  runExportDemo: async () => {
    set({ isLoading: true, error: null });
    try {
      const fileName = await coreService.runExportDemo();
      const processState = coreService.getProcessState();
      const records = coreService.getRecords();
      const logs = AuditLogger.getAllLogs();
      set({ records, processState, logs, isLoading: false });
      return fileName;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return '';
    }
  },

  runFullDemo: async () => {
    set({ isLoading: true, error: null });
    try {
      await get().runImportDemo();
      await get().runCadDemo();
      await get().runExportDemo();
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateCadLayerName: (id: string, cadName: string) => {
    const record = coreService.updateCadLayerName(id, cadName, '老梁');
    if (record) {
      const records = coreService.getRecords();
      const processState = coreService.getProcessState();
      const logs = AuditLogger.getAllLogs();
      set({ records, processState, logs });
    }
  },

  manualCorrect: (id: string, length: number) => {
    const record = coreService.manualCorrect(id, length, '老梁');
    if (record) {
      const records = coreService.getRecords();
      const logs = AuditLogger.getAllLogs();
      set({ records, logs });
    }
  },

  forceRecalculate: (id: string) => {
    const record = coreService.forceRecalculate(id, '老梁');
    if (record) {
      const records = coreService.getRecords();
      const logs = AuditLogger.getAllLogs();
      set({ records, logs });
    }
  },

  setActiveRecord: (id: string | null) => {
    coreService.setActiveRecord(id);
    const processState = coreService.getProcessState();
    set({ processState });
  },

  getLogsByRecordId: (id: string) => {
    return AuditLogger.getLogsByRecordId(id);
  },

  reset: () => {
    coreService.reset();
    const records = createInitialRecords();
    set({
      records,
      processState: {
        currentStep: ProcessStep.NOT_STARTED,
        importCompleted: false,
        cadCompleted: false,
        exportCompleted: false,
        activeRecordId: null,
      },
      logs: [],
      error: null,
    });
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
}));
