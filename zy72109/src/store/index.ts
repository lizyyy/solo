import { create } from 'zustand';
import type { AppStore, Batch, DataRecord, PhysicsParams, ThresholdConfig, ConfirmStatus, RecordStatus, ConflictResolution, DecisionTrace, ReportFormat } from '@/types';
import { DataCleaner } from '@/utils/dataCleaner';
import { CoolingLoadCalculator } from '@/utils/coolingLoadCalculator';
import { UnitConverter } from '@/utils/unitConverter';
import { generateSampleData, generateReportMarkdown } from '@/utils/sampleData';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function saveToLocalStorage(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function loadFromLocalStorage(key: string): any {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('LocalStorage load failed:', e);
    return null;
  }
}

const DEFAULT_PARAMS: PhysicsParams = {
  iceArea: 1800,
  iceAreaUnit: 'm²',
  iceThickness: 30,
  iceThicknessUnit: 'mm',
  iceTemperature: -5,
  iceTemperatureUnit: '°C',
  ambientTemperature: 22,
  ambientTemperatureUnit: '°C',
  ambientHumidity: 60,
  peopleCount: 50,
  equipmentPower: 15,
  equipmentPowerUnit: 'kW',
  lightingPower: 8,
  lightingPowerUnit: 'kW',
};

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  maxCoolingLoad: 500,
  maxCoolingLoadUnit: 'kW',
  warningRatio: 0.8,
  extremeOutlierThreshold: 1.5,
  expectedIntervalMinutes: 30,
};

export const useStore = create<AppStore>((set, get) => ({
  currentBatch: null,
  batches: loadFromLocalStorage('iceRink_batches') || [],
  activeTab: 'workbench',
  selectedRecordId: null,
  comparisonBatchIds: [],
  operatorName: loadFromLocalStorage('iceRink_operator') || '',

  createBatch: (name: string, params?: Partial<PhysicsParams>) => {
    const batch: Batch = {
      id: generateId(),
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: { ...DEFAULT_PARAMS, ...params },
      thresholds: { ...DEFAULT_THRESHOLDS },
      status: 'draft',
      createdBy: get().operatorName || '未知',
      records: [],
      calculationResults: [],
      abnormalRecords: [],
      inspectionData: [],
      decisionTraces: [],
    };

    set(state => {
      const newBatches = [...state.batches, batch];
      saveToLocalStorage('iceRink_batches', newBatches.map(b => ({
        ...b,
        records: b.records.slice(0, 10),
        calculationResults: [],
        abnormalRecords: b.abnormalRecords.slice(0, 5),
      })));
      return { batches: newBatches, currentBatch: batch };
    });

    return batch;
  },

  importData: (batchId: string, data: any[], fileName: string) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        const newRecords = DataCleaner.parseRawData(data, fileName, batchId);
        const updatedBatch = {
          ...b,
          records: [...b.records, ...newRecords],
          status: 'processing' as const,
          updatedAt: new Date(),
        };
        return updatedBatch;
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  importInspection: (batchId: string, data: any[], sourceName: string, caliber: 'new' | 'old') => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        const inspectionRecords = data.map(row => ({
          id: generateId(),
          batchId,
          source: sourceName,
          caliber,
          recordDate: new Date(row.date || row.日期 || new Date()),
          rawData: row,
          conflictStatus: 'none' as const,
          conflictingFields: [],
        }));
        const updatedBatch = {
          ...b,
          inspectionData: [...b.inspectionData, ...inspectionRecords],
          updatedAt: new Date(),
        };
        return updatedBatch;
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  runCalculation: (batchId: string) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        
        const calculator = new CoolingLoadCalculator(b.parameters);
        const calculationResults = b.records.map(record => calculator.calculateTotal(record));
        
        const abnormalRecords = [...b.abnormalRecords];
        const maxLoadKw = UnitConverter.convertPower(
          b.thresholds.maxCoolingLoad,
          b.thresholds.maxCoolingLoadUnit,
          'kW'
        );

        calculationResults.forEach((result, idx) => {
          const record = b.records[idx];
          const existingAbnormal = abnormalRecords.find(a => a.recordId === record.id);
          
          if (result.totalLoad > maxLoadKw) {
            if (!existingAbnormal) {
              abnormalRecords.push({
                id: generateId(),
                recordId: record.id,
                type: result.totalLoad > maxLoadKw * 1.5 ? 'extreme_value' : 'threshold_exceed',
                severity: result.totalLoad > maxLoadKw * 1.5 ? 'critical' : 'high',
                threshold: maxLoadKw,
                actualValue: result.totalLoad,
                description: `制冷负荷 ${result.totalLoad.toFixed(2)} kW 超过安全阈值 ${maxLoadKw.toFixed(0)} kW`,
                confirmStatus: 'pending',
              });
            }
          } else if (result.totalLoad > maxLoadKw * b.thresholds.warningRatio) {
            if (!existingAbnormal) {
              abnormalRecords.push({
                id: generateId(),
                recordId: record.id,
                type: 'threshold_exceed',
                severity: 'medium',
                threshold: maxLoadKw * b.thresholds.warningRatio,
                actualValue: result.totalLoad,
                description: `制冷负荷 ${result.totalLoad.toFixed(2)} kW 接近安全阈值`,
                confirmStatus: 'pending',
              });
            }
          }
        });

        const allLoads = calculationResults.map(r => r.totalLoad);
        const outlierResult = DataCleaner.detectExtremes(allLoads, b.thresholds.extremeOutlierThreshold);
        
        outlierResult.outlierIndices.forEach(idx => {
          const record = b.records[idx];
          if (record && !abnormalRecords.find(a => a.recordId === record.id)) {
            abnormalRecords.push({
              id: generateId(),
              recordId: record.id,
              type: 'extreme_value',
              severity: 'high',
              threshold: outlierResult.bounds.upper,
              actualValue: allLoads[idx],
              description: `极端值: ${allLoads[idx].toFixed(2)} kW 超出IQR上限`,
              confirmStatus: 'pending',
            });
          }
        });

        return {
          ...b,
          calculationResults,
          abnormalRecords,
          status: 'completed' as const,
          updatedAt: new Date(),
        };
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  updateParameters: (batchId: string, params: Partial<PhysicsParams>, reason: string) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        const before = { ...b.parameters };
        return {
          ...b,
          parameters: { ...b.parameters, ...params },
          updatedAt: new Date(),
          decisionTraces: [...b.decisionTraces, {
            id: generateId(),
            batchId,
            decisionType: 'parameter_change' as const,
            beforeValue: before,
            afterValue: { ...b.parameters, ...params },
            reason,
            operator: get().operatorName || '未知',
            timestamp: new Date(),
          }],
        };
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  updateThresholds: (batchId: string, thresholds: Partial<ThresholdConfig>, reason: string) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        const before = { ...b.thresholds };
        return {
          ...b,
          thresholds: { ...b.thresholds, ...thresholds },
          updatedAt: new Date(),
          decisionTraces: [...b.decisionTraces, {
            id: generateId(),
            batchId,
            decisionType: 'parameter_change' as const,
            beforeValue: before,
            afterValue: { ...b.thresholds, ...thresholds },
            reason,
            operator: get().operatorName || '未知',
            timestamp: new Date(),
          }],
        };
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  confirmAbnormal: (batchId: string, abnormalId: string, status: ConfirmStatus, notes: string) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        const abnormalRecords = b.abnormalRecords.map(a => {
          if (a.id !== abnormalId) return a;
          return {
            ...a,
            confirmStatus: status,
            confirmedBy: get().operatorName || '未知',
            confirmedAt: new Date(),
            notes,
          };
        });
        return {
          ...b,
          abnormalRecords,
          updatedAt: new Date(),
          decisionTraces: [...b.decisionTraces, {
            id: generateId(),
            batchId,
            recordId: b.abnormalRecords.find(a => a.id === abnormalId)?.recordId,
            decisionType: 'extreme_handle' as const,
            beforeValue: 'pending',
            afterValue: status,
            reason: notes || `异常记录${status === 'confirmed' ? '已确认' : '已驳回'}`,
            operator: get().operatorName || '未知',
            timestamp: new Date(),
          }],
        };
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  resolveConflict: (batchId: string, inspectionId: string, resolution: ConflictResolution, notes: string) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        const inspectionData = b.inspectionData.map(ins => {
          if (ins.id !== inspectionId) return ins;
          return {
            ...ins,
            conflictStatus: 'resolved' as const,
            resolution: {
              type: resolution,
              resolvedBy: get().operatorName || '未知',
              resolvedAt: new Date(),
              notes,
            },
          };
        });
        return {
          ...b,
          inspectionData,
          updatedAt: new Date(),
          decisionTraces: [...b.decisionTraces, {
            id: generateId(),
            batchId,
            decisionType: 'conflict_resolve' as const,
            beforeValue: 'pending',
            afterValue: resolution,
            reason: notes,
            operator: get().operatorName || '未知',
            timestamp: new Date(),
          }],
        };
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  updateRecordStatus: (batchId: string, recordId: string, status: RecordStatus, reason: string, notes?: string) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        const records = b.records.map(r => {
          if (r.id !== recordId) return r;
          return { ...r, recordStatus: status, notes };
        });
        return {
          ...b,
          records,
          updatedAt: new Date(),
          decisionTraces: [...b.decisionTraces, {
            id: generateId(),
            batchId,
            recordId,
            decisionType: 'status_change' as const,
            beforeValue: b.records.find(r => r.id === recordId)?.recordStatus,
            afterValue: status,
            reason,
            operator: get().operatorName || '未知',
            timestamp: new Date(),
            notes,
          }],
        };
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      saveToLocalStorage('iceRink_batches', batches);
      return { batches, currentBatch };
    });
  },

  saveBatch: (batchId: string) => {
    const state = get();
    const batch = state.batches.find(b => b.id === batchId);
    if (!batch) return;
    saveToLocalStorage(`iceRink_batch_${batchId}`, batch);
    saveToLocalStorage('iceRink_batches', state.batches.map(b => ({
      ...b,
      records: b.records.slice(0, 20),
      calculationResults: [],
      abnormalRecords: b.abnormalRecords.slice(0, 10),
    })));
  },

  loadBatch: (batchId: string) => {
    const state = get();
    const batch = state.batches.find(b => b.id === batchId);
    if (batch) {
      set({ currentBatch: batch, activeTab: 'calculate' });
    }
  },

  deleteBatch: (batchId: string) => {
    set(state => {
      const batches = state.batches.filter(b => b.id !== batchId);
      localStorage.removeItem(`iceRink_batch_${batchId}`);
      saveToLocalStorage('iceRink_batches', batches);
      const currentBatch = state.currentBatch?.id === batchId ? null : state.currentBatch;
      return { batches, currentBatch };
    });
  },

  exportReport: (batchId: string, format: ReportFormat): Blob => {
    const state = get();
    const batch = state.batches.find(b => b.id === batchId);
    if (!batch) return new Blob([], { type: 'text/plain' });

    if (format === 'markdown') {
      const md = generateReportMarkdown(batch);
      return new Blob([md], { type: 'text/markdown;charset=utf-8' });
    }

    const md = generateReportMarkdown(batch);
    return new Blob([md], { type: 'text/plain;charset=utf-8' });
  },

  addDecisionTrace: (batchId: string, trace: Omit<DecisionTrace, 'id' | 'timestamp'>) => {
    set(state => {
      const batches = state.batches.map(b => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          decisionTraces: [...b.decisionTraces, {
            ...trace,
            id: generateId(),
            timestamp: new Date(),
          }],
          updatedAt: new Date(),
        };
      });
      const currentBatch = state.currentBatch?.id === batchId
        ? batches.find(b => b.id === batchId) || null
        : state.currentBatch;
      return { batches, currentBatch };
    });
  },

  setActiveTab: (tab: string) => set({ activeTab: tab }),
  setSelectedRecordId: (id: string | null) => set({ selectedRecordId: id }),
  
  toggleComparisonBatch: (batchId: string) => {
    set(state => {
      const ids = state.comparisonBatchIds;
      return {
        comparisonBatchIds: ids.includes(batchId)
          ? ids.filter(id => id !== batchId)
          : [...ids, batchId],
      };
    });
  },

  setOperatorName: (name: string) => {
    set({ operatorName: name });
    saveToLocalStorage('iceRink_operator', name);
  },

  generateSampleData: () => {
    const batch = generateSampleData();
    set(state => {
      const newBatches = [...state.batches, batch];
      saveToLocalStorage('iceRink_batches', newBatches);
      return { batches: newBatches, currentBatch: batch };
    });
    return batch;
  },
}));
