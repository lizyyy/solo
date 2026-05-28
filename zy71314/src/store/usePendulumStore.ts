import { create } from 'zustand';
import { PendulumData, CalculationResult, ChartType, DataFlag, ErrorSource } from '@/types';
import { linearRegression, residuals, detectOutliersIQR, detectOutliersZScore, stdDev } from '@/utils/statistics';
import { validateAllData } from '@/utils/validation';
import { ERROR_SOURCES_TEMPLATE, STANDARD_GRAVITY } from '@/utils/constants';

interface PendulumStore {
  data: PendulumData[];
  result: CalculationResult | null;
  selectedChart: ChartType;
  studentName: string;
  experimentDate: string;
  isCalculating: boolean;
  error: string | null;
  chartRefs: Map<ChartType, HTMLCanvasElement>;
  
  addData: (data: Partial<PendulumData>) => void;
  updateData: (id: string, data: Partial<PendulumData>) => void;
  removeData: (id: string) => void;
  toggleExclude: (id: string) => void;
  clearAllData: () => void;
  setStudentName: (name: string) => void;
  setExperimentDate: (date: string) => void;
  setSelectedChart: (chart: ChartType) => void;
  setChartRef: (type: ChartType, canvas: HTMLCanvasElement | null) => void;
  calculateGravity: () => void;
  loadSampleData: (sampleData: Partial<PendulumData>[]) => void;
  getFlags: () => DataFlag[];
  getOutliers: () => string[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const usePendulumStore = create<PendulumStore>((set, get) => ({
  data: [],
  result: null,
  selectedChart: 't2-vs-l',
  studentName: '',
  experimentDate: new Date().toISOString().split('T')[0],
  isCalculating: false,
  error: null,
  chartRefs: new Map(),

  addData: (partialData) => {
    const newData: PendulumData = {
      id: generateId(),
      length: partialData.length || 0,
      period: partialData.period || 0,
      measurements: partialData.measurements || 1,
      angle: partialData.angle || 5,
      studentName: partialData.studentName || '',
      notes: partialData.notes || '',
      timestamp: Date.now(),
      flags: [],
      excluded: false,
    };
    
    set((state) => {
      const newDataList = [...state.data, newData];
      const validatedData = validateAllData(newDataList);
      return { data: validatedData, result: null };
    });
  },

  updateData: (id, partialData) => {
    set((state) => {
      const newDataList = state.data.map((d) =>
        d.id === id ? { ...d, ...partialData } : d
      );
      const validatedData = validateAllData(newDataList);
      return { data: validatedData, result: null };
    });
  },

  removeData: (id) => {
    set((state) => {
      const newDataList = state.data.filter((d) => d.id !== id);
      const validatedData = validateAllData(newDataList);
      return { data: validatedData, result: null };
    });
  },

  toggleExclude: (id) => {
    set((state) => {
      const newDataList = state.data.map((d) =>
        d.id === id ? { ...d, excluded: !d.excluded } : d
      );
      return { data: newDataList, result: null };
    });
  },

  clearAllData: () => {
    set({ data: [], result: null, error: null });
  },

  setStudentName: (name) => {
    set({ studentName: name });
  },

  setExperimentDate: (date) => {
    set({ experimentDate: date });
  },

  setSelectedChart: (chart) => {
    set({ selectedChart: chart });
  },

  setChartRef: (type, canvas) => {
    set((state) => {
      const newRefs = new Map(state.chartRefs);
      if (canvas) {
        newRefs.set(type, canvas);
      } else {
        newRefs.delete(type);
      }
      return { chartRefs: newRefs };
    });
  },

  calculateGravity: () => {
    const state = get();
    const validData = state.data.filter((d) => !d.excluded && d.length > 0 && d.period > 0);
    
    if (validData.length < 2) {
      set({ error: '至少需要2条有效数据才能进行拟合计算', result: null });
      return;
    }
    
    set({ isCalculating: true, error: null });
    
    try {
      const lengths = validData.map((d) => d.length);
      const periods = validData.map((d) => d.period);
      const tSquared = periods.map((T) => T * T);
      
      const regression = linearRegression(lengths, tSquared);
      const res = residuals(lengths, tSquared, regression.slope, regression.intercept);
      
      const gravity = (4 * Math.PI * Math.PI) / regression.slope;
      const gravityUncertainty = gravity * (regression.slopeStdErr / regression.slope);
      
      const outlierIndices = [...new Set([
        ...detectOutliersIQR(res),
        ...detectOutliersZScore(res, 2),
      ])];
      const outliers = outlierIndices.map((i) => validData[i]?.id).filter(Boolean) as string[];
      
      const periodStd = stdDev(periods);
      const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
      const avgAngle = validData.reduce((sum, d) => sum + d.angle, 0) / validData.length;
      
      const errorSources: ErrorSource[] = ERROR_SOURCES_TEMPLATE.map((source, index) => {
        let contribution = 0;
        switch (index) {
          case 0: contribution = 20; break;
          case 1: contribution = 35 + (periodStd / avgPeriod) * 100; break;
          case 2: contribution = avgAngle > 15 ? 25 : 10; break;
          case 3: contribution = 15; break;
          case 4: contribution = 10; break;
        }
        return { ...source, contribution };
      });
      
      const totalContribution = errorSources.reduce((sum, e) => sum + e.contribution, 0);
      const normalizedErrorSources = errorSources.map((e) => ({
        ...e,
        contribution: (e.contribution / totalContribution) * 100,
      }));
      
      const result: CalculationResult = {
        gravity,
        gravityUncertainty,
        fitSlope: regression.slope,
        fitIntercept: regression.intercept,
        rSquared: regression.rSquared,
        residuals: res,
        outliers,
        errorSources: normalizedErrorSources,
        validDataCount: validData.length,
        totalDataCount: state.data.length,
      };
      
      set({ result, isCalculating: false });
    } catch (err) {
      set({ 
        error: err instanceof Error ? err.message : '计算过程中发生未知错误', 
        isCalculating: false,
        result: null 
      });
    }
  },

  loadSampleData: (sampleData) => {
    const newData: PendulumData[] = sampleData.map((d) => ({
      id: generateId(),
      length: d.length || 0,
      period: d.period || 0,
      measurements: d.measurements || 1,
      angle: d.angle || 5,
      studentName: d.studentName || '',
      notes: d.notes || '',
      timestamp: Date.now(),
      flags: [],
      excluded: false,
    }));
    
    const validatedData = validateAllData(newData);
    set({ data: validatedData, result: null, error: null });
  },

  getFlags: () => {
    const state = get();
    return state.data.flatMap((d) => d.flags);
  },

  getOutliers: () => {
    return get().result?.outliers || [];
  },
}));
