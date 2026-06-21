import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';
import type {
  InspectionRecord,
  Anomaly,
  AnomalyStatus,
  DataCheckResult,
  CameraState,
  Scheme,
  ProcessNote,
} from '../types';
import { DEFAULT_CAMERA_STATE } from '../types';
import { sampleRecords, sampleInitialNotes } from '../data/sampleData';
import { createAnomaliesFromRecords, runFullDataCheck } from '../data/dataChecker';

function generateId(): string {
  return 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

interface AppState {
  records: InspectionRecord[];
  anomalies: Anomaly[];
  dataCheckResult: DataCheckResult | null;
  
  selectedAnomalyId: string | null;
  hoveredAnomalyId: string | null;
  cameraState: CameraState;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  
  schemes: Scheme[];
  currentSchemeId: string | null;
  currentOperator: string;
  
  highlightedSourceRow: number | null;
  
  loadSampleData: () => void;
  runDataCheck: () => void;
  selectAnomaly: (id: string | null) => void;
  setHoveredAnomaly: (id: string | null) => void;
  updateAnomalyStatus: (id: string, status: AnomalyStatus, note: string) => void;
  addSupplementNote: (anomalyId: string, content: string) => void;
  saveScheme: (name: string) => void;
  loadScheme: (id: string) => void;
  deleteScheme: (id: string) => void;
  setCameraState: (state: CameraState) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  mergeDuplicateAnomalies: (ids: string[]) => void;
  resetView: () => void;
  setHighlightedSourceRow: (row: number | null) => void;
  setCurrentOperator: (name: string) => void;
  clearAllData: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      records: [],
      anomalies: [],
      dataCheckResult: null,
      
      selectedAnomalyId: null,
      hoveredAnomalyId: null,
      cameraState: DEFAULT_CAMERA_STATE,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      
      schemes: [],
      currentSchemeId: null,
      currentOperator: '阿乔',
      
      highlightedSourceRow: null,
      
      loadSampleData: () => {
        const records = sampleRecords;
        const anomalies = createAnomaliesFromRecords(records);
        
        anomalies.forEach(anomaly => {
          const initialNote = sampleInitialNotes[anomaly.recordId];
          if (initialNote) {
            anomaly.status = initialNote.status as AnomalyStatus;
            anomaly.notes = initialNote.notes.map((n, i) => ({
              id: generateId(),
              anomalyId: anomaly.id,
              content: n.content,
              operator: n.operator,
              timestamp: format(new Date(Date.now() - (initialNote.notes.length - i) * 3600000), 'yyyy-MM-dd HH:mm:ss'),
              isSupplement: n.isSupplement,
              previousContent: n.previousContent,
              statusChange: i === 0 ? (initialNote.status as AnomalyStatus) : undefined,
            }));
          }
        });
        
        const dataCheckResult = runFullDataCheck(records, anomalies);
        
        set({ records, anomalies, dataCheckResult });
      },
      
      runDataCheck: () => {
        const { records, anomalies } = get();
        const result = runFullDataCheck(records, anomalies);
        set({ dataCheckResult: result });
      },
      
      selectAnomaly: (id) => {
        set({ selectedAnomalyId: id });
      },
      
      setHoveredAnomaly: (id) => {
        set({ hoveredAnomalyId: id });
      },
      
      updateAnomalyStatus: (id, status, note) => {
        const { anomalies, currentOperator } = get();
        const anomaly = anomalies.find(a => a.id === id);
        if (!anomaly) return;
        
        const newNote: ProcessNote = {
          id: generateId(),
          anomalyId: id,
          content: note,
          operator: currentOperator,
          timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          isSupplement: false,
          statusChange: status,
        };
        
        const updatedAnomalies = anomalies.map(a =>
          a.id === id
            ? { ...a, status, notes: [...a.notes, newNote] }
            : a
        );
        
        set({ anomalies: updatedAnomalies });
        get().runDataCheck();
      },
      
      addSupplementNote: (anomalyId, content) => {
        const { anomalies, currentOperator } = get();
        const anomaly = anomalies.find(a => a.id === anomalyId);
        if (!anomaly) return;
        
        const previousContent = anomaly.notes.length > 0
          ? anomaly.notes[anomaly.notes.length - 1].content
          : '';
        
        const newNote: ProcessNote = {
          id: generateId(),
          anomalyId,
          content,
          operator: currentOperator,
          timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          isSupplement: true,
          previousContent,
        };
        
        const updatedAnomalies = anomalies.map(a =>
          a.id === anomalyId
            ? { ...a, notes: [...a.notes, newNote] }
            : a
        );
        
        set({ anomalies: updatedAnomalies });
      },
      
      saveScheme: (name) => {
        const { anomalies, cameraState, schemes, currentSchemeId, currentOperator } = get();
        
        const anomalyStates: Record<string, { status: AnomalyStatus; notes: ProcessNote[] }> = {};
        anomalies.forEach(a => {
          anomalyStates[a.id] = {
            status: a.status,
            notes: [...a.notes],
          };
        });
        
        const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        
        if (currentSchemeId) {
          const updatedSchemes = schemes.map(s =>
            s.id === currentSchemeId
              ? { ...s, name, updatedAt: now, cameraState, anomalyStates }
              : s
          );
          set({ schemes: updatedSchemes });
        } else {
          const newScheme: Scheme = {
            id: generateId(),
            name,
            createdAt: now,
            updatedAt: now,
            operator: currentOperator,
            cameraState,
            anomalyStates,
          };
          set({ schemes: [...schemes, newScheme], currentSchemeId: newScheme.id });
        }
      },
      
      loadScheme: (id) => {
        const { schemes } = get();
        const scheme = schemes.find(s => s.id === id);
        if (!scheme) return;
        
        const { anomalies: currentAnomalies } = get();
        const updatedAnomalies = currentAnomalies.map(a => {
          const state = scheme.anomalyStates[a.id];
          if (state) {
            return { ...a, status: state.status, notes: [...state.notes] };
          }
          return a;
        });
        
        set({
          currentSchemeId: id,
          cameraState: scheme.cameraState,
          anomalies: updatedAnomalies,
        });
      },
      
      deleteScheme: (id) => {
        const { schemes, currentSchemeId } = get();
        set({
          schemes: schemes.filter(s => s.id !== id),
          currentSchemeId: currentSchemeId === id ? null : currentSchemeId,
        });
      },
      
      setCameraState: (state) => {
        set({ cameraState: state });
      },
      
      toggleLeftPanel: () => {
        set(state => ({ leftPanelCollapsed: !state.leftPanelCollapsed }));
      },
      
      toggleRightPanel: () => {
        set(state => ({ rightPanelCollapsed: !state.rightPanelCollapsed }));
      },
      
      mergeDuplicateAnomalies: (ids) => {
        const { anomalies } = get();
        if (ids.length < 2) return;
        
        const [primaryId, ...duplicateIds] = ids;
        const primary = anomalies.find(a => a.id === primaryId);
        if (!primary) return;
        
        const updatedAnomalies = anomalies.map(a => {
          if (a.id === primaryId) {
            return { ...a, isDuplicate: false, duplicateOf: undefined };
          }
          if (duplicateIds.includes(a.id)) {
            return { ...a, isDuplicate: true, duplicateOf: primaryId };
          }
          return a;
        });
        
        set({ anomalies: updatedAnomalies });
      },
      
      resetView: () => {
        set({
          cameraState: DEFAULT_CAMERA_STATE,
          selectedAnomalyId: null,
          hoveredAnomalyId: null,
          highlightedSourceRow: null,
        });
      },
      
      setHighlightedSourceRow: (row) => {
        set({ highlightedSourceRow: row });
      },
      
      setCurrentOperator: (name) => {
        set({ currentOperator: name });
      },
      
      clearAllData: () => {
        set({
          records: [],
          anomalies: [],
          dataCheckResult: null,
          selectedAnomalyId: null,
          hoveredAnomalyId: null,
          currentSchemeId: null,
        });
      },
    }),
    {
      name: 'bridge-hoisting-preview-state',
      partialize: (state) => ({
        records: state.records,
        anomalies: state.anomalies,
        dataCheckResult: state.dataCheckResult,
        cameraState: state.cameraState,
        schemes: state.schemes,
        currentSchemeId: state.currentSchemeId,
        currentOperator: state.currentOperator,
        leftPanelCollapsed: state.leftPanelCollapsed,
        rightPanelCollapsed: state.rightPanelCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.records.length === 0) {
          state.loadSampleData();
        }
      },
    }
  )
);
