import { create } from 'zustand';
import type {
  Project,
  SensorRecord,
  DeviceParam,
  FieldNote,
  ManualCorrection,
  ValidationIssue,
  DataConflict,
  CalculationResult,
  HistoryVersion,
  ProjectSnapshot,
  DiffItem,
  DiffType,
} from '../types';
import { validateSensorRecords, validateDeviceParams, markDirtyData } from '../utils/validation';
import { detectAllConflicts } from '../utils/conflict';
import {
  calculateRange,
  calculateMaxHeight,
  calculateFlightTime,
  calculateImpactEnergy,
  getSafetyLevel,
  getProcessingSuggestion,
  getSafetyLevelLabel,
} from '../utils/physics';
import { convertValue } from '../utils/units';
import { normalSample } from '../data/samples';

interface ProjectState {
  currentProject: Project | null;
  sensorRecords: SensorRecord[];
  deviceParams: DeviceParam[];
  fieldNotes: FieldNote[];
  manualCorrections: ManualCorrection[];
  validationIssues: ValidationIssue[];
  dataConflicts: DataConflict[];
  calculationResult: CalculationResult | null;
  historyVersions: HistoryVersion[];
  selectedHistoryIds: string[];
  isCalculating: boolean;
  isDirty: boolean;

  loadSampleData: (sample: 'normal' | 'dirty' | 'conflict') => void;
  clearProject: () => void;
  updateProjectName: (name: string) => void;

  addSensorRecord: (record: Omit<SensorRecord, 'id' | 'projectId'>) => void;
  updateSensorRecord: (id: string, updates: Partial<SensorRecord>) => void;
  removeSensorRecord: (id: string) => void;

  addDeviceParam: (param: Omit<DeviceParam, 'id' | 'projectId'>) => void;
  updateDeviceParam: (id: string, updates: Partial<DeviceParam>) => void;
  removeDeviceParam: (id: string) => void;

  addFieldNote: (note: Omit<FieldNote, 'id' | 'projectId'>) => void;
  updateFieldNote: (id: string, updates: Partial<FieldNote>) => void;
  removeFieldNote: (id: string) => void;

  resolveConflict: (conflictId: string, decision: string) => void;

  runValidation: () => void;
  runConflictDetection: () => void;
  runCalculation: () => void;
  runFullAnalysis: () => void;

  createVersion: (description: string, createdBy: string) => void;
  toggleHistorySelection: (versionId: string) => void;
  compareVersions: (versionAId: string, versionBId: string) => DiffItem[];
  clearHistorySelection: () => void;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function compareObjects(
  objA: unknown,
  objB: unknown,
  path: string = ''
): DiffItem[] {
  const diffs: DiffItem[] = [];

  if (objA === objB) return diffs;

  if (objA === undefined || objA === null) {
    if (objB !== undefined && objB !== null) {
      diffs.push({ field: path.split('.').pop() || path, oldValue: objA, newValue: objB, type: 'added', path });
    }
    return diffs;
  }

  if (objB === undefined || objB === null) {
    diffs.push({ field: path.split('.').pop() || path, oldValue: objA, newValue: objB, type: 'removed', path });
    return diffs;
  }

  if (Array.isArray(objA) && Array.isArray(objB)) {
    const maxLen = Math.max(objA.length, objB.length);
    for (let i = 0; i < maxLen; i++) {
      diffs.push(...compareObjects(objA[i], objB[i], `${path}[${i}]`));
    }
    return diffs;
  }

  if (typeof objA === 'object' && typeof objB === 'object') {
    const keysA = Object.keys(objA as Record<string, unknown>);
    const keysB = Object.keys(objB as Record<string, unknown>);
    const allKeys = new Set([...keysA, ...keysB]);

    allKeys.forEach((key) => {
      const valA = (objA as Record<string, unknown>)[key];
      const valB = (objB as Record<string, unknown>)[key];
      diffs.push(...compareObjects(valA, valB, path ? `${path}.${key}` : key));
    });
    return diffs;
  }

  diffs.push({ field: path.split('.').pop() || path, oldValue: objA, newValue: objB, type: 'modified', path });
  return diffs;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  sensorRecords: [],
  deviceParams: [],
  fieldNotes: [],
  manualCorrections: [],
  validationIssues: [],
  dataConflicts: [],
  calculationResult: null,
  historyVersions: [],
  selectedHistoryIds: [],
  isCalculating: false,
  isDirty: false,

  loadSampleData: (sampleType) => {
    let sample = normalSample;
    if (sampleType === 'dirty') {
      const { dirtySample } = require('../data/samples');
      sample = dirtySample;
    } else if (sampleType === 'conflict') {
      const { conflictSample } = require('../data/samples');
      sample = conflictSample;
    }

    set({
      currentProject: deepClone(sample.project),
      sensorRecords: deepClone(sample.sensorRecords),
      deviceParams: deepClone(sample.deviceParams),
      fieldNotes: deepClone(sample.fieldNotes),
      manualCorrections: [],
      validationIssues: [],
      dataConflicts: [],
      calculationResult: null,
      historyVersions: [],
      selectedHistoryIds: [],
      isDirty: false,
    });
  },

  clearProject: () => {
    set({
      currentProject: null,
      sensorRecords: [],
      deviceParams: [],
      fieldNotes: [],
      manualCorrections: [],
      validationIssues: [],
      dataConflicts: [],
      calculationResult: null,
      isDirty: false,
    });
  },

  updateProjectName: (name) => {
    set((state) => ({
      currentProject: state.currentProject ? { ...state.currentProject, name, updatedAt: new Date().toISOString() } : null,
      isDirty: true,
    }));
  },

  addSensorRecord: (record) => {
    const projectId = get().currentProject?.id || 'temp';
    set((state) => ({
      sensorRecords: [...state.sensorRecords, { ...record, id: generateId('rec'), projectId }],
      isDirty: true,
    }));
  },

  updateSensorRecord: (id, updates) => {
    set((state) => ({
      sensorRecords: state.sensorRecords.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      isDirty: true,
    }));
  },

  removeSensorRecord: (id) => {
    set((state) => ({
      sensorRecords: state.sensorRecords.filter((r) => r.id !== id),
      isDirty: true,
    }));
  },

  addDeviceParam: (param) => {
    const projectId = get().currentProject?.id || 'temp';
    set((state) => ({
      deviceParams: [...state.deviceParams, { ...param, id: generateId('param'), projectId }],
      isDirty: true,
    }));
  },

  updateDeviceParam: (id, updates) => {
    set((state) => ({
      deviceParams: state.deviceParams.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      isDirty: true,
    }));
  },

  removeDeviceParam: (id) => {
    set((state) => ({
      deviceParams: state.deviceParams.filter((p) => p.id !== id),
      isDirty: true,
    }));
  },

  addFieldNote: (note) => {
    const projectId = get().currentProject?.id || 'temp';
    set((state) => ({
      fieldNotes: [...state.fieldNotes, { ...note, id: generateId('note'), projectId }],
      isDirty: true,
    }));
  },

  updateFieldNote: (id, updates) => {
    set((state) => ({
      fieldNotes: state.fieldNotes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      isDirty: true,
    }));
  },

  removeFieldNote: (id) => {
    set((state) => ({
      fieldNotes: state.fieldNotes.filter((n) => n.id !== id),
      isDirty: true,
    }));
  },

  resolveConflict: (conflictId, decision) => {
    set((state) => ({
      dataConflicts: state.dataConflicts.map((c) =>
        c.id === conflictId ? { ...c, userDecision: decision, decidedAt: new Date().toISOString() } : c
      ),
      isDirty: true,
    }));
  },

  runValidation: () => {
    const { currentProject, sensorRecords, deviceParams } = get();
    if (!currentProject) return;

    const markedRecords = markDirtyData(sensorRecords, currentProject.id);
    const sensorIssues = validateSensorRecords(markedRecords, currentProject.id);
    const paramIssues = validateDeviceParams(deviceParams, currentProject.id);

    set({
      sensorRecords: markedRecords,
      validationIssues: [...sensorIssues, ...paramIssues],
    });
  },

  runConflictDetection: () => {
    const { currentProject, fieldNotes, sensorRecords, deviceParams } = get();
    if (!currentProject) return;

    const conflicts = detectAllConflicts(fieldNotes, sensorRecords, deviceParams);
    set({ dataConflicts: conflicts });
  },

  runCalculation: () => {
    const { currentProject, sensorRecords, deviceParams } = get();
    if (!currentProject || sensorRecords.length === 0) return;

    set({ isCalculating: true });

    try {
      const heightParam = deviceParams.find((p) => p.paramName.includes('高度') || p.paramName.includes('弹射'));
      const massParam = deviceParams.find((p) => p.paramName.includes('弹丸') || p.paramName.includes('质量'));

      const height = heightParam?.value ?? 1;
      const heightUnit = heightParam?.unit ?? 'm';
      const mass = massParam?.value ?? 0.15;
      const massUnit = massParam?.unit ?? 'kg';

      const avgRecord = sensorRecords.reduce(
        (acc, r) => ({
          angle: acc.angle + (r.angle ?? 0),
          velocity: acc.velocity + (r.velocity ?? 0),
          count: acc.count + (r.velocity !== null ? 1 : 0),
        }),
        { angle: 0, velocity: 0, count: 0 }
      );

      const avgAngle = avgRecord.count > 0 ? avgRecord.angle / sensorRecords.length : 30;
      const avgVelocity = avgRecord.count > 0 ? avgRecord.velocity / avgRecord.count : 10;

      const velocityMps = convertValue(avgVelocity, sensorRecords[0]?.velocityUnit || 'm/s', 'm/s');
      const heightM = convertValue(height, heightUnit, 'm');
      const massKg = convertValue(mass, massUnit, 'kg');

      const range = calculateRange(velocityMps, avgAngle, heightM);
      const maxHeight = calculateMaxHeight(velocityMps, avgAngle, heightM);
      const flightTime = calculateFlightTime(velocityMps, avgAngle, heightM);
      const impactEnergy = calculateImpactEnergy(massKg, velocityMps, avgAngle, heightM);

      const safetyLevel = getSafetyLevel(impactEnergy);
      const suggestion = getProcessingSuggestion(safetyLevel);

      const result: CalculationResult = {
        id: generateId('res'),
        projectId: currentProject.id,
        physicsModel: 'full',
        range: parseFloat(range.toFixed(3)),
        rangeUnit: 'm',
        impactEnergy: parseFloat(impactEnergy.toFixed(2)),
        impactEnergyUnit: 'J',
        maxHeight: parseFloat(maxHeight.toFixed(3)),
        maxHeightUnit: 'm',
        flightTime: parseFloat(flightTime.toFixed(3)),
        flightTimeUnit: 's',
        safetyLevel: safetyLevel as unknown as import('../types').SafetyLevel,
        unitSystem: 'metric',
        calculatedAt: new Date().toISOString(),
        processingSuggestion: suggestion,
      };

      set({
        calculationResult: result,
        currentProject: { ...currentProject, status: 'calculated', updatedAt: new Date().toISOString() },
      });
    } finally {
      set({ isCalculating: false });
    }
  },

  runFullAnalysis: () => {
    const { runValidation, runConflictDetection, runCalculation } = get();
    runValidation();
    runConflictDetection();
    runCalculation();
  },

  createVersion: (description, createdBy) => {
    const state = get();
    if (!state.currentProject) return;

    const snapshot: ProjectSnapshot = {
      project: deepClone(state.currentProject),
      sensorRecords: deepClone(state.sensorRecords),
      deviceParams: deepClone(state.deviceParams),
      fieldNotes: deepClone(state.fieldNotes),
      manualCorrections: deepClone(state.manualCorrections),
      calculationResult: state.calculationResult ? deepClone(state.calculationResult) : undefined,
    };

    const newVersion: HistoryVersion = {
      id: generateId('ver'),
      projectId: state.currentProject.id,
      versionNumber: state.historyVersions.length + 1,
      snapshot,
      changeDescription: description,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    set((s) => ({
      historyVersions: [...s.historyVersions, newVersion],
      isDirty: false,
    }));
  },

  toggleHistorySelection: (versionId) => {
    set((state) => {
      const isSelected = state.selectedHistoryIds.includes(versionId);
      let newSelection: string[];
      if (isSelected) {
        newSelection = state.selectedHistoryIds.filter((id) => id !== versionId);
      } else {
        newSelection = state.selectedHistoryIds.length < 2 ? [...state.selectedHistoryIds, versionId] : [state.selectedHistoryIds[1], versionId];
      }
      return { selectedHistoryIds: newSelection };
    });
  },

  compareVersions: (versionAId, versionBId) => {
    const { historyVersions } = get();
    const versionA = historyVersions.find((v) => v.id === versionAId);
    const versionB = historyVersions.find((v) => v.id === versionBId);

    if (!versionA || !versionB) return [];

    return compareObjects(versionA.snapshot, versionB.snapshot);
  },

  clearHistorySelection: () => {
    set({ selectedHistoryIds: [] });
  },
}));
