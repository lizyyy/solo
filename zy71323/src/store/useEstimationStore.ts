import { create } from 'zustand';
import type {
  EstimationParams,
  EstimationRecord,
  CalculationResult,
  ValidationResult,
  TideCycleSegment,
  DeviceConstraints,
} from '@/types';
import { calculateEnergy } from '@/engine/calculator';
import { validateParams } from '@/engine/validator';
import { generateReproducibleId } from '@/engine/reproducibleId';
import { saveRecord, getRecord } from '@/utils/storage';

const defaultDeviceConstraints: DeviceConstraints = {
  ratedPower: 1000,
  maxFlowVelocity: 5.0,
  minFlowVelocity: 0.5,
  maxEfficiency: 0.5,
  impellerDiameter: 10,
};

const defaultTideCycles: TideCycleSegment[] = [
  { id: '1', startTime: 0, endTime: 6, tideHeight: 8.5, flowVelocity: 2.5, phase: 'flood' },
  { id: '2', startTime: 6, endTime: 12, tideHeight: 0, flowVelocity: 0.3, phase: 'slack' },
  { id: '3', startTime: 12, endTime: 18, tideHeight: -8.5, flowVelocity: 2.3, phase: 'ebb' },
  { id: '4', startTime: 18, endTime: 24, tideHeight: 0, flowVelocity: 0.3, phase: 'slack' },
];

const defaultParams: EstimationParams = {
  tidalRange: 8.5,
  tidalRangeUnit: 'm',
  flowVelocity: 2.5,
  flowVelocityUnit: 'm/s',
  impellerArea: 78.54,
  impellerAreaUnit: 'm²',
  efficiency: 0.45,
  tideCycles: defaultTideCycles,
  deviceConstraints: defaultDeviceConstraints,
};

interface EstimationState {
  params: EstimationParams;
  result: CalculationResult | null;
  validation: ValidationResult;
  currentRecord: EstimationRecord | null;
  isCalculating: boolean;
  parentId: string | null;
  
  setParams: (params: Partial<EstimationParams>) => void;
  setTideCycles: (cycles: TideCycleSegment[]) => void;
  setDeviceConstraints: (constraints: Partial<DeviceConstraints>) => void;
  addCycleSegment: () => void;
  removeCycleSegment: (id: string) => void;
  updateCycleSegment: (id: string, updates: Partial<TideCycleSegment>) => void;
  validateAndUpdate: () => void;
  calculate: () => Promise<void>;
  saveCurrentRecord: (note?: string) => Promise<string | null>;
  loadRecord: (id: string, asContinuation?: boolean) => Promise<void>;
  loadSampleData: () => void;
  loadInvalidSample: () => void;
  reset: () => void;
}

export const useEstimationStore = create<EstimationState>((set, get) => ({
  params: defaultParams,
  result: null,
  validation: { valid: false, errors: [], warnings: [] },
  currentRecord: null,
  isCalculating: false,
  parentId: null,

  setParams: (updates) => {
    set(state => ({
      params: { ...state.params, ...updates },
      result: null,
    }));
    get().validateAndUpdate();
  },

  setTideCycles: (cycles) => {
    set(state => ({
      params: { ...state.params, tideCycles: cycles },
      result: null,
    }));
    get().validateAndUpdate();
  },

  setDeviceConstraints: (updates) => {
    set(state => ({
      params: {
        ...state.params,
        deviceConstraints: { ...state.params.deviceConstraints, ...updates },
      },
      result: null,
    }));
    get().validateAndUpdate();
  },

  addCycleSegment: () => {
    const { tideCycles } = get().params;
    const lastSegment = tideCycles[tideCycles.length - 1];
    const newStartTime = lastSegment ? lastSegment.endTime : 0;
    const newEndTime = Math.min(newStartTime + 6, 24);
    
    if (newStartTime >= 24) return;
    
    const newSegment: TideCycleSegment = {
      id: Date.now().toString(),
      startTime: newStartTime,
      endTime: newEndTime,
      tideHeight: 0,
      flowVelocity: 0,
      phase: 'slack',
    };
    
    set(state => ({
      params: {
        ...state.params,
        tideCycles: [...state.params.tideCycles, newSegment],
      },
      result: null,
    }));
    get().validateAndUpdate();
  },

  removeCycleSegment: (id) => {
    set(state => ({
      params: {
        ...state.params,
        tideCycles: state.params.tideCycles.filter(c => c.id !== id),
      },
      result: null,
    }));
    get().validateAndUpdate();
  },

  updateCycleSegment: (id, updates) => {
    set(state => ({
      params: {
        ...state.params,
        tideCycles: state.params.tideCycles.map(c =>
          c.id === id ? { ...c, ...updates } : c
        ),
      },
      result: null,
    }));
    get().validateAndUpdate();
  },

  validateAndUpdate: () => {
    const validation = validateParams(get().params);
    set({ validation });
  },

  calculate: async () => {
    set({ isCalculating: true });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { params } = get();
      const validation = validateParams(params);
      
      if (!validation.valid) {
        set({ validation, result: null, isCalculating: false });
        return;
      }
      
      const result = calculateEnergy(params);
      const deviceErrors = result.deviceCheck.violations.filter(v => v.severity === 'error');
      
      if (deviceErrors.length > 0) {
        validation.errors.push({
          code: 'DEVICE_CONSTRAINT_FAILED',
          field: 'deviceConstraints',
          message: '设备约束不满足',
          suggestion: deviceErrors.map(e => e.message).join('；'),
        });
        validation.valid = false;
      }
      
      set({ result, validation, isCalculating: false });
    } catch (error) {
      console.error('Calculation error:', error);
      set({ isCalculating: false });
    }
  },

  saveCurrentRecord: async (note) => {
    const { params, result, validation, parentId } = get();
    
    if (!result) {
      return null;
    }
    
    try {
      const id = await generateReproducibleId(params);
      const existing = await getRecord(id);
      
      if (existing) {
        return id;
      }
      
      const record: EstimationRecord = {
        id,
        params,
        result,
        validation,
        status: validation.valid ? 'valid' : 'invalid',
        parentId,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note,
      };
      
      await saveRecord(record);
      set({ currentRecord: record });
      return id;
    } catch (error) {
      console.error('Save error:', error);
      return null;
    }
  },

  loadRecord: async (id, asContinuation = false) => {
    const record = await getRecord(id);
    if (!record) return;
    
    if (asContinuation) {
      set({
        params: record.params,
        result: null,
        validation: validateParams(record.params),
        parentId: record.id,
        currentRecord: null,
      });
    } else {
      set({
        params: record.params,
        result: record.result,
        validation: record.validation,
        currentRecord: record,
        parentId: null,
      });
    }
  },

  loadSampleData: () => {
    set({
      params: { ...defaultParams },
      result: null,
      validation: { valid: false, errors: [], warnings: [] },
      currentRecord: null,
      parentId: null,
    });
    get().validateAndUpdate();
  },

  loadInvalidSample: () => {
    const invalidParams: EstimationParams = {
      ...defaultParams,
      flowVelocityUnit: 'knots',
      efficiency: 45,
      tideCycles: [
        { id: '1', startTime: 0, endTime: 6, tideHeight: 8.5, flowVelocity: 2.5, phase: 'flood' },
        { id: '3', startTime: 12, endTime: 18, tideHeight: -8.5, flowVelocity: 2.3, phase: 'ebb' },
        { id: '4', startTime: 18, endTime: 23, tideHeight: 0, flowVelocity: 0.3, phase: 'slack' },
      ],
    };
    
    set({
      params: invalidParams,
      result: null,
      validation: validateParams(invalidParams),
      currentRecord: null,
      parentId: null,
    });
  },

  reset: () => {
    set({
      params: { ...defaultParams },
      result: null,
      validation: { valid: false, errors: [], warnings: [] },
      currentRecord: null,
      parentId: null,
    });
    get().validateAndUpdate();
  },
}));
