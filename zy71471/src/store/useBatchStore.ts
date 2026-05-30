import { create } from 'zustand';
import type {
  Batch,
  SamplePoint,
  FitResult,
  HistoryRecord,
  ValidationError,
  FilterCriteria,
  BatchStatus,
  FitMode,
} from '@/types';
import {
  mockBatches,
  mockSamplePoints,
  mockHistoryRecords,
  mockFitResults,
} from '@/data/mockBatches';
import { runAllValidations } from '@/utils/validation/rules';
import { exponentialFit, calculateResiduals } from '@/utils/fitting/exponentialFit';
import { convertTimeToSeconds } from '@/utils/units';
import dayjs from 'dayjs';

interface BatchState {
  batches: Batch[];
  currentBatch: Batch | null;
  samplePoints: SamplePoint[];
  fitResult: FitResult | null;
  historyRecords: HistoryRecord[];
  validationErrors: ValidationError[];
  filters: FilterCriteria;
  loading: boolean;
  showOutliers: boolean;
  activeTab: 'data' | 'analysis' | 'history' | 'report';
  fitMode: FitMode;
  dataVersion: number;

  setCurrentBatch: (id: string | null) => void;
  createBatch: (data: Partial<Batch>) => Batch;
  updateBatch: (updates: Partial<Batch>, manual?: boolean) => void;
  addSamplePoints: (points: Omit<SamplePoint, 'id'>[]) => void;
  updateSamplePoint: (id: string, updates: Partial<SamplePoint>) => void;
  deleteSamplePoint: (id: string) => void;
  runValidation: () => void;
  runFit: () => Promise<void>;
  applyFilters: (filters: Partial<FilterCriteria>) => void;
  resetFilters: () => void;
  setShowOutliers: (show: boolean) => void;
  setActiveTab: (tab: 'data' | 'analysis' | 'history' | 'report') => void;
  setFitMode: (mode: FitMode) => void;
  revertToVersion: (version: number) => void;
  getFilteredBatches: () => Batch[];
  generateBatchNo: () => string;
  addHistoryRecord: (record: Omit<HistoryRecord, 'id' | 'timestamp'>) => void;
  updateBatchStatus: (status: BatchStatus) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useBatchStore = create<BatchState>((set, get) => ({
  batches: mockBatches,
  currentBatch: null,
  samplePoints: [],
  fitResult: null,
  historyRecords: [],
  validationErrors: [],
  filters: {
    dateRange: null,
    studentName: null,
    resistanceRange: null,
    capacitanceRange: null,
    status: null,
  },
  loading: false,
  showOutliers: true,
  activeTab: 'data',
  fitMode: 'discharge',
  dataVersion: 1,

  generateBatchNo: () => {
    const today = dayjs().format('YYYYMMDD');
    const todayBatches = get().batches.filter((b) =>
      b.batchNo.includes(today)
    );
    const seq = todayBatches.length + 1;
    return `RC-${today}-${seq.toString().padStart(3, '0')}`;
  },

  setCurrentBatch: (id) => {
    if (!id) {
      set({
        currentBatch: null,
        samplePoints: [],
        fitResult: null,
        historyRecords: [],
        validationErrors: [],
      });
      return;
    }

    const batch = get().batches.find((b) => b.id === id);
    if (!batch) return;

    const points = mockSamplePoints[id] || [];
    const fitResult = mockFitResults[id] || null;
    const history = mockHistoryRecords[id] || [];

    const pointsWithResiduals = fitResult
      ? calculateResiduals(points, fitResult, batch.fitMode, batch.timeUnit)
      : points;

    const errors = runAllValidations(batch, pointsWithResiduals);

    set({
      currentBatch: batch,
      samplePoints: pointsWithResiduals,
      fitResult,
      historyRecords: history,
      validationErrors: errors,
      fitMode: batch.fitMode,
      dataVersion: batch.dataVersion,
    });
  },

  createBatch: (data) => {
    const newBatch: Batch = {
      id: generateId(),
      batchNo: get().generateBatchNo(),
      studentName: '',
      experimentDate: dayjs().format('YYYY-MM-DD'),
      resistance: null,
      resistanceUnit: 'kΩ',
      capacitance: null,
      capacitanceUnit: 'μF',
      initialVoltage: null,
      supplyVoltage: null,
      timeUnit: 's',
      status: 'draft',
      needsReanalysis: false,
      fitMode: 'discharge',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataVersion: 1,
      ...data,
    };

    set((state) => ({
      batches: [...state.batches, newBatch],
    }));

    get().addHistoryRecord({
      batchId: newBatch.id,
      fieldName: 'batch',
      oldValue: null,
      newValue: newBatch.batchNo,
      modifiedBy: newBatch.studentName || '当前用户',
      changeType: 'manual',
      description: '创建新实验批次',
      version: 1,
    });

    return newBatch;
  },

  updateBatch: (updates, manual = true) => {
    const { currentBatch, dataVersion } = get();
    if (!currentBatch) return;

    const oldValues: Record<string, string | null> = {};
    Object.keys(updates).forEach((key) => {
      const oldVal = currentBatch[key as keyof Batch];
      oldValues[key] = oldVal !== null && oldVal !== undefined ? String(oldVal) : null;
    });

    const newDataVersion = manual ? dataVersion + 1 : dataVersion;

    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === currentBatch.id
          ? {
              ...b,
              ...updates,
              dataVersion: newDataVersion,
              updatedAt: new Date().toISOString(),
              needsReanalysis: manual ? true : b.needsReanalysis,
            }
          : b
      ),
      currentBatch: {
        ...currentBatch,
        ...updates,
        dataVersion: newDataVersion,
        updatedAt: new Date().toISOString(),
        needsReanalysis: manual ? true : currentBatch.needsReanalysis,
      },
      dataVersion: newDataVersion,
    }));

    if (manual) {
      Object.entries(updates).forEach(([key, value]) => {
        const labels: Record<string, string> = {
          resistance: '电阻值',
          capacitance: '电容值',
          initialVoltage: '初始电压',
          supplyVoltage: '电源电压',
          timeUnit: '时间单位',
          fitMode: '拟合模式',
          studentName: '学生姓名',
          experimentDate: '实验日期',
        };
        const label = labels[key] || key;
        get().addHistoryRecord({
          batchId: currentBatch.id,
          fieldName: key,
          oldValue: oldValues[key],
          newValue: value !== null && value !== undefined ? String(value) : null,
          modifiedBy: currentBatch.studentName || '当前用户',
          changeType: 'manual',
          description: `修改${label}`,
          version: newDataVersion,
        });
      });
    }

    get().runValidation();
  },

  addSamplePoints: (points) => {
    const { currentBatch, samplePoints, dataVersion } = get();
    if (!currentBatch) return;

    const newPoints: SamplePoint[] = points.map((p, i) => ({
      ...p,
      id: generateId(),
      batchId: currentBatch.id,
      sequence: samplePoints.length + i + 1,
    }));

    const updatedPoints = [...samplePoints, ...newPoints].sort(
      (a, b) => a.time - b.time
    );

    set((state) => ({
      samplePoints: updatedPoints,
      dataVersion: dataVersion + 1,
    }));

    get().addHistoryRecord({
      batchId: currentBatch.id,
      fieldName: 'samplePoints',
      oldValue: `${samplePoints.length}个采样点`,
      newValue: `${updatedPoints.length}个采样点`,
      modifiedBy: currentBatch.studentName || '当前用户',
      changeType: 'manual',
      description: `新增${newPoints.length}个采样点`,
      version: dataVersion + 1,
    });

    get().updateBatch({ needsReanalysis: true }, false);
    get().runValidation();
  },

  updateSamplePoint: (id, updates) => {
    const { currentBatch, samplePoints, dataVersion } = get();
    if (!currentBatch) return;

    const point = samplePoints.find((p) => p.id === id);
    if (!point) return;

    set((state) => ({
      samplePoints: state.samplePoints
        .map((p) => (p.id === id ? { ...p, ...updates } : p))
        .sort((a, b) => a.time - b.time),
      dataVersion: dataVersion + 1,
    }));

    get().addHistoryRecord({
      batchId: currentBatch.id,
      fieldName: 'samplePoint',
      oldValue: `t=${point.time}, V=${point.voltage}`,
      newValue:
        `t=${updates.time ?? point.time}, V=${updates.voltage ?? point.voltage}`,
      modifiedBy: currentBatch.studentName || '当前用户',
      changeType: 'manual',
      description: `修改第${point.sequence}个采样点`,
      version: dataVersion + 1,
    });

    get().updateBatch({ needsReanalysis: true }, false);
    get().runValidation();
  },

  deleteSamplePoint: (id) => {
    const { currentBatch, samplePoints, dataVersion } = get();
    if (!currentBatch) return;

    const point = samplePoints.find((p) => p.id === id);
    if (!point) return;

    set((state) => ({
      samplePoints: state.samplePoints
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, sequence: i + 1 })),
      dataVersion: dataVersion + 1,
    }));

    get().addHistoryRecord({
      batchId: currentBatch.id,
      fieldName: 'samplePoint',
      oldValue: `t=${point.time}, V=${point.voltage}`,
      newValue: null,
      modifiedBy: currentBatch.studentName || '当前用户',
      changeType: 'manual',
      description: `删除第${point.sequence}个采样点`,
      version: dataVersion + 1,
    });

    get().updateBatch({ needsReanalysis: true }, false);
    get().runValidation();
  },

  runValidation: () => {
    const { currentBatch, samplePoints } = get();
    if (!currentBatch) {
      set({ validationErrors: [] });
      return;
    }

    const errors = runAllValidations(currentBatch, samplePoints);
    set({ validationErrors: errors });
  },

  runFit: async () => {
    const { currentBatch, samplePoints, fitMode, dataVersion } = get();
    if (!currentBatch || samplePoints.length < 3) return;

    set({ loading: true });

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const result = exponentialFit(samplePoints, {
        mode: fitMode,
        timeUnit: currentBatch.timeUnit,
      });

      const pointsWithResiduals = calculateResiduals(
        samplePoints,
        result,
        fitMode,
        currentBatch.timeUnit
      );

      const newDataVersion = dataVersion + 1;

      set({
        fitResult: { ...result, dataVersion: newDataVersion },
        samplePoints: pointsWithResiduals,
        dataVersion: newDataVersion,
        loading: false,
      });

      get().addHistoryRecord({
        batchId: currentBatch.id,
        fieldName: 'fitResult',
        oldValue: get().fitResult
          ? `τ=${get().fitResult!.tau.toFixed(4)}s, R²=${get().fitResult!.rSquared.toFixed(4)}`
          : null,
        newValue: `τ=${result.tau.toFixed(4)}s, R²=${result.rSquared.toFixed(4)}`,
        modifiedBy: '系统',
        changeType: 'automatic',
        description: `完成指数拟合计算 (${result.algorithm})`,
        version: newDataVersion,
      });

      get().updateBatch(
        {
          needsReanalysis: false,
          status: 'analyzed',
        },
        false
      );
    } catch (error) {
      console.error('拟合失败:', error);
      set({ loading: false });
    }
  },

  applyFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  resetFilters: () => {
    set({
      filters: {
        dateRange: null,
        studentName: null,
        resistanceRange: null,
        capacitanceRange: null,
        status: null,
      },
    });
  },

  setShowOutliers: (show) => {
    set({ showOutliers: show });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  setFitMode: (mode) => {
    const { currentBatch, fitMode } = get();
    if (fitMode === mode) return;

    set({ fitMode: mode });

    if (currentBatch) {
      get().updateBatch({ fitMode: mode }, true);
    }
  },

  revertToVersion: (version) => {
    console.log('恢复到版本:', version);
  },

  getFilteredBatches: () => {
    const { batches, filters } = get();
    let filtered = [...batches];

    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      filtered = filtered.filter(
        (b) => b.experimentDate >= start && b.experimentDate <= end
      );
    }

    if (filters.studentName) {
      filtered = filtered.filter((b) =>
        b.studentName.includes(filters.studentName!)
      );
    }

    if (filters.status) {
      filtered = filtered.filter((b) => b.status === filters.status);
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  addHistoryRecord: (record) => {
    const newRecord: HistoryRecord = {
      ...record,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      historyRecords: [newRecord, ...state.historyRecords],
    }));
  },

  updateBatchStatus: (status) => {
    const { currentBatch } = get();
    if (!currentBatch) return;

    get().updateBatch({ status }, false);

    get().addHistoryRecord({
      batchId: currentBatch.id,
      fieldName: 'status',
      oldValue: currentBatch.status,
      newValue: status,
      modifiedBy: currentBatch.studentName || '当前用户',
      changeType: 'manual',
      description: status === 'reported' ? '生成实验报告' : `更新状态为${status}`,
      version: get().dataVersion + 1,
    });
  },
}));
