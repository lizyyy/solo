import { create } from 'zustand';
import { 
  SoundVelocityInput, 
  Anomaly, 
  CalculationResult, 
  EvidenceChain, 
  CompleteRecord,
  ViewState,
  AuditLogEntry,
} from '../types';
import { calculateSoundVelocity, recalculate } from '../engine/calculator';
import { validateResult } from '../engine/validator';
import { buildEvidenceChain } from '../engine/evidence';
import { generateId } from '../utils/crypto';
import { saveRecord, getRecord, getAllRecords, getRecordsByFilter } from './database';

interface AppState {
  currentInput: SoundVelocityInput;
  currentAnomalies: Anomaly[];
  currentResult: CalculationResult | null;
  currentEvidenceChain: EvidenceChain | null;
  currentAuditLog: AuditLogEntry[];
  currentRecordId: string | null;
  records: CompleteRecord[];
  viewState: ViewState;
  isCalculating: boolean;
  error: string | null;

  setInput: (input: Partial<SoundVelocityInput>) => void;
  resetInput: () => void;
  performCalculation: () => Promise<void>;
  loadRecord: (id: string) => Promise<void>;
  recalculateRecord: (id: string) => Promise<void>;
  loadAllRecords: () => Promise<void>;
  filterRecords: (filters: Partial<ViewState['filters']>) => Promise<void>;
  setViewState: (state: Partial<ViewState>) => void;
  saveCurrentRecord: () => Promise<string>;
  clearError: () => void;
}

const defaultInput: SoundVelocityInput = {
  temperature: null,
  distance: null,
  timeDiff: null,
  timeUnit: 's',
  deviceDeviation: null,
  deviceId: undefined,
  timestamp: Date.now(),
  operator: undefined,
  notes: undefined,
};

const defaultViewState: ViewState = {
  filters: {
    temperatureRange: [-50, 100],
    dateRange: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()],
    deviceIds: [],
    conclusionTypes: [],
  },
  sort: { field: 'createdAt', order: 'desc' },
  pagination: { page: 1, pageSize: 20 },
  visibleColumns: ['temperature', 'theoreticalValue', 'measuredValue', 'deviationPercent', 'conclusion'],
};

export const useAppStore = create<AppState>((set, get) => ({
  currentInput: { ...defaultInput, timestamp: Date.now() },
  currentAnomalies: [],
  currentResult: null,
  currentEvidenceChain: null,
  currentAuditLog: [],
  currentRecordId: null,
  records: [],
  viewState: defaultViewState,
  isCalculating: false,
  error: null,

  setInput: (input: Partial<SoundVelocityInput>) => {
    set(state => ({
      currentInput: {
        ...state.currentInput,
        ...input,
        timestamp: Date.now(),
      },
    }));
  },

  resetInput: () => {
    set({
      currentInput: { ...defaultInput, timestamp: Date.now() },
      currentAnomalies: [],
      currentResult: null,
      currentEvidenceChain: null,
      currentAuditLog: [],
      currentRecordId: null,
      error: null,
    });
  },

  performCalculation: async () => {
    set({ isCalculating: true, error: null });
    try {
      const input = get().currentInput;
      const result = await calculateSoundVelocity(input);
      const anomalies = validateResult(input, result);
      const { evidenceChain, auditLog } = buildEvidenceChain(input, anomalies, result);

      set({
        currentResult: result,
        currentAnomalies: anomalies,
        currentEvidenceChain: evidenceChain,
        currentAuditLog: auditLog,
        isCalculating: false,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '计算过程中发生错误',
        isCalculating: false,
      });
    }
  },

  loadRecord: async (id: string) => {
    set({ isCalculating: true, error: null });
    try {
      const record = await getRecord(id);
      if (!record) {
        throw new Error('记录不存在');
      }
      set({
        currentInput: record.input,
        currentAnomalies: record.anomalies,
        currentResult: record.result,
        currentEvidenceChain: record.evidenceChain,
        currentAuditLog: record.auditLog,
        currentRecordId: record.id,
        isCalculating: false,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '加载记录失败',
        isCalculating: false,
      });
    }
  },

  recalculateRecord: async (id: string) => {
    set({ isCalculating: true, error: null });
    try {
      const record = await getRecord(id);
      if (!record) {
        throw new Error('记录不存在');
      }
      
      const result = await recalculate(record.input, record.result.inputHash);
      const anomalies = validateResult(record.input, result);
      const { evidenceChain, auditLog } = buildEvidenceChain(record.input, anomalies, result);

      set({
        currentInput: record.input,
        currentAnomalies: anomalies,
        currentResult: result,
        currentEvidenceChain: evidenceChain,
        currentAuditLog: auditLog,
        currentRecordId: record.id,
        isCalculating: false,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '复算失败',
        isCalculating: false,
      });
    }
  },

  loadAllRecords: async () => {
    try {
      const records = await getAllRecords();
      const sortedRecords = records.sort((a, b) => b.createdAt - a.createdAt);
      set({ records: sortedRecords });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载记录失败' });
    }
  },

  filterRecords: async (filters: Partial<ViewState['filters']>) => {
    try {
      const records = await getRecordsByFilter(filters);
      const sortedRecords = records.sort((a, b) => b.createdAt - a.createdAt);
      set({ records: sortedRecords });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '筛选记录失败' });
    }
  },

  setViewState: (state: Partial<ViewState>) => {
    set(s => ({
      viewState: {
        ...s.viewState,
        ...state,
        filters: {
          ...s.viewState.filters,
          ...state.filters,
        },
      },
    }));
  },

  saveCurrentRecord: async (): Promise<string> => {
    const { currentInput, currentAnomalies, currentResult, currentEvidenceChain, currentAuditLog } = get();
    
    if (!currentResult) {
      throw new Error('请先执行计算');
    }

    const record: CompleteRecord = {
      id: generateId(),
      input: { ...currentInput },
      anomalies: [...currentAnomalies],
      result: { ...currentResult },
      evidenceChain: { ...currentEvidenceChain },
      auditLog: [...currentAuditLog],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await saveRecord(record);
    set({ currentRecordId: record.id });
    return record.id;
  },

  clearError: () => {
    set({ error: null });
  },
}));
