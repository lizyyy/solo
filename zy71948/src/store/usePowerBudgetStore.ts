import { create } from 'zustand';
import {
  PayloadPlan,
  FaultRecord,
  OrbitElement,
  Anomaly,
  StateSnapshot,
  AuditLog,
  TimeSystem
} from '../types';
import { generateId } from '../utils/hash';
import { createSnapshot, loadSnapshot } from '../utils/snapshotManager';
import { runAnomalyDetection } from '../utils/anomalyDetector';
import { generateBriefing, BriefingResult } from '../utils/briefingGenerator';
import {
  mockPayloadPlans,
  mockFaultRecords,
  mockOrbitElements,
  mockSnapshots,
  mockAuditLogs
} from '../data/mockData';

interface PowerBudgetState {
  payloadPlans: PayloadPlan[];
  faultRecords: FaultRecord[];
  orbitElements: OrbitElement[];
  anomalies: Anomaly[];
  snapshots: StateSnapshot[];
  auditLogs: AuditLog[];
  currentDate: string;
  displayTimeSystem: TimeSystem;
  selectedSnapshotId: string | null;
  viewMode: 'current' | 'snapshot';

  initMockData: () => void;

  addPayloadPlan: (plan: Omit<PayloadPlan, 'id' | 'createdAt'>) => void;
  updatePayloadPlan: (id: string, plan: Partial<PayloadPlan>, reason: string) => void;
  deletePayloadPlan: (id: string, reason: string, operator: string) => void;

  addFaultRecord: (record: Omit<FaultRecord, 'id' | 'createdAt'>) => void;
  updateFaultRecord: (id: string, record: Partial<FaultRecord>, reason: string) => void;
  deleteFaultRecord: (id: string, reason: string, operator: string) => void;

  addOrbitElement: (element: Omit<OrbitElement, 'id' | 'createdAt'>) => void;
  updateOrbitElement: (id: string, element: Partial<OrbitElement>, reason: string) => void;
  deleteOrbitElement: (id: string, reason: string, operator: string) => void;

  runAnomalyDetection: () => Anomaly[];
  createSnapshot: (operator: string, description: string) => Promise<StateSnapshot | null>;
  loadSnapshotById: (snapshotId: string) => void;
  exitSnapshotMode: () => void;
  confirmAnomaly: (id: string, reviewer: string, remark: string) => void;
  generateBriefing: (date: string) => Promise<BriefingResult | null>;

  setCurrentDate: (date: string) => void;
  setDisplayTimeSystem: (system: TimeSystem) => void;

  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
}

const STORAGE_KEY = 'power-budget-calendar-data';

export const usePowerBudgetStore = create<PowerBudgetState>((set, get) => ({
  payloadPlans: [],
  faultRecords: [],
  orbitElements: [],
  anomalies: [],
  snapshots: [],
  auditLogs: [],
  currentDate: new Date().toISOString().split('T')[0],
  displayTimeSystem: 'UTC',
  selectedSnapshotId: null,
  viewMode: 'current',

  initMockData: () => {
    const anomalies = runAnomalyDetection(
      new Date().toISOString().split('T')[0],
      mockPayloadPlans,
      mockFaultRecords,
      mockOrbitElements
    );
    
    set({
      payloadPlans: mockPayloadPlans,
      faultRecords: mockFaultRecords,
      orbitElements: mockOrbitElements,
      snapshots: mockSnapshots,
      auditLogs: mockAuditLogs,
      anomalies
    });
  },

  addPayloadPlan: (plan) => {
    const newPlan: PayloadPlan = {
      ...plan,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'PAYLOAD',
      recordId: newPlan.id,
      action: 'CREATE',
      operator: plan.operator,
      timestamp: new Date().toISOString(),
      oldValue: '',
      newValue: JSON.stringify(newPlan),
      reason: plan.recordType === 'SUPPLEMENT' ? '补材料' : '真修改'
    };
    
    set(state => ({
      payloadPlans: [...state.payloadPlans, newPlan],
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  updatePayloadPlan: (id, plan, reason) => {
    const oldPlan = get().payloadPlans.find(p => p.id === id);
    if (!oldPlan) return;
    
    const newPlan = { ...oldPlan, ...plan };
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'PAYLOAD',
      recordId: id,
      action: 'UPDATE',
      operator: plan.operator || oldPlan.operator,
      timestamp: new Date().toISOString(),
      oldValue: JSON.stringify(oldPlan),
      newValue: JSON.stringify(newPlan),
      reason
    };
    
    set(state => ({
      payloadPlans: state.payloadPlans.map(p => p.id === id ? newPlan : p),
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  deletePayloadPlan: (id, reason, operator) => {
    const oldPlan = get().payloadPlans.find(p => p.id === id);
    if (!oldPlan) return;
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'PAYLOAD',
      recordId: id,
      action: 'DELETE',
      operator,
      timestamp: new Date().toISOString(),
      oldValue: JSON.stringify(oldPlan),
      newValue: '',
      reason
    };
    
    set(state => ({
      payloadPlans: state.payloadPlans.filter(p => p.id !== id),
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  addFaultRecord: (record) => {
    const newRecord: FaultRecord = {
      ...record,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'FAULT',
      recordId: newRecord.id,
      action: 'CREATE',
      operator: record.operator,
      timestamp: new Date().toISOString(),
      oldValue: '',
      newValue: JSON.stringify(newRecord),
      reason: record.recordType === 'SUPPLEMENT' ? '补材料' : '真修改'
    };
    
    set(state => ({
      faultRecords: [...state.faultRecords, newRecord],
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  updateFaultRecord: (id, record, reason) => {
    const oldRecord = get().faultRecords.find(f => f.id === id);
    if (!oldRecord) return;
    
    const newRecord = { ...oldRecord, ...record };
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'FAULT',
      recordId: id,
      action: 'UPDATE',
      operator: record.operator || oldRecord.operator,
      timestamp: new Date().toISOString(),
      oldValue: JSON.stringify(oldRecord),
      newValue: JSON.stringify(newRecord),
      reason
    };
    
    set(state => ({
      faultRecords: state.faultRecords.map(f => f.id === id ? newRecord : f),
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  deleteFaultRecord: (id, reason, operator) => {
    const oldRecord = get().faultRecords.find(f => f.id === id);
    if (!oldRecord) return;
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'FAULT',
      recordId: id,
      action: 'DELETE',
      operator,
      timestamp: new Date().toISOString(),
      oldValue: JSON.stringify(oldRecord),
      newValue: '',
      reason
    };
    
    set(state => ({
      faultRecords: state.faultRecords.filter(f => f.id !== id),
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  addOrbitElement: (element) => {
    const newElement: OrbitElement = {
      ...element,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'ORBIT',
      recordId: newElement.id,
      action: 'CREATE',
      operator: element.operator,
      timestamp: new Date().toISOString(),
      oldValue: '',
      newValue: JSON.stringify(newElement),
      reason: element.recordType === 'SUPPLEMENT' ? '补材料' : '真修改'
    };
    
    set(state => ({
      orbitElements: [...state.orbitElements, newElement],
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  updateOrbitElement: (id, element, reason) => {
    const oldElement = get().orbitElements.find(o => o.id === id);
    if (!oldElement) return;
    
    const newElement = { ...oldElement, ...element };
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'ORBIT',
      recordId: id,
      action: 'UPDATE',
      operator: element.operator || oldElement.operator,
      timestamp: new Date().toISOString(),
      oldValue: JSON.stringify(oldElement),
      newValue: JSON.stringify(newElement),
      reason
    };
    
    set(state => ({
      orbitElements: state.orbitElements.map(o => o.id === id ? newElement : o),
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  deleteOrbitElement: (id, reason, operator) => {
    const oldElement = get().orbitElements.find(o => o.id === id);
    if (!oldElement) return;
    
    const log: AuditLog = {
      id: generateId(),
      recordType: 'ORBIT',
      recordId: id,
      action: 'DELETE',
      operator,
      timestamp: new Date().toISOString(),
      oldValue: JSON.stringify(oldElement),
      newValue: '',
      reason
    };
    
    set(state => ({
      orbitElements: state.orbitElements.filter(o => o.id !== id),
      auditLogs: [...state.auditLogs, log]
    }));
    
    get().runAnomalyDetection();
  },

  runAnomalyDetection: () => {
    const state = get();
    const anomalies = runAnomalyDetection(
      state.currentDate,
      state.payloadPlans,
      state.faultRecords,
      state.orbitElements
    );
    
    const existingIds = state.anomalies.filter(a => a.status !== 'PENDING').map(a => a.id);
    const retainedAnomalies = state.anomalies.filter(a => existingIds.includes(a.id));
    
    set({ anomalies: [...retainedAnomalies, ...anomalies] });
    return anomalies;
  },

  createSnapshot: async (operator, description) => {
    const state = get();
    const snapshot = await createSnapshot(
      state.payloadPlans,
      state.faultRecords,
      state.orbitElements,
      operator,
      description
    );
    
    set(s => ({ snapshots: [...s.snapshots, snapshot] }));
    return snapshot;
  },

  loadSnapshotById: (snapshotId) => {
    const snapshot = get().snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return;
    
    const data = loadSnapshot(snapshot);
    set({
      payloadPlans: data.payloadPlans,
      faultRecords: data.faultRecords,
      orbitElements: data.orbitElements,
      selectedSnapshotId: snapshotId,
      viewMode: 'snapshot'
    });
    
    get().runAnomalyDetection();
  },

  exitSnapshotMode: () => {
    set({
      selectedSnapshotId: null,
      viewMode: 'current'
    });
    get().loadFromLocalStorage();
  },

  confirmAnomaly: (id, reviewer, remark) => {
    set(state => ({
      anomalies: state.anomalies.map(a =>
        a.id === id
          ? { ...a, status: 'CONFIRMED', reviewer, reviewedAt: new Date().toISOString(), reviewRemark: remark }
          : a
      )
    }));
  },

  generateBriefing: async (date) => {
    const state = get();
    return await generateBriefing(
      date,
      state.payloadPlans,
      state.faultRecords,
      state.orbitElements,
      state.anomalies,
      state.auditLogs,
      state.displayTimeSystem
    );
  },

  setCurrentDate: (date) => {
    set({ currentDate: date });
    get().runAnomalyDetection();
  },

  setDisplayTimeSystem: (system) => {
    set({ displayTimeSystem: system });
  },

  saveToLocalStorage: () => {
    const state = get();
    const data = {
      payloadPlans: state.payloadPlans,
      faultRecords: state.faultRecords,
      orbitElements: state.orbitElements,
      anomalies: state.anomalies,
      snapshots: state.snapshots,
      auditLogs: state.auditLogs,
      currentDate: state.currentDate,
      displayTimeSystem: state.displayTimeSystem,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  loadFromLocalStorage: () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    
    try {
      const data = JSON.parse(stored);
      set({
        payloadPlans: data.payloadPlans || [],
        faultRecords: data.faultRecords || [],
        orbitElements: data.orbitElements || [],
        anomalies: data.anomalies || [],
        snapshots: data.snapshots || [],
        auditLogs: data.auditLogs || [],
        currentDate: data.currentDate || new Date().toISOString().split('T')[0],
        displayTimeSystem: data.displayTimeSystem || 'UTC'
      });
      return true;
    } catch {
      return false;
    }
  }
}));
