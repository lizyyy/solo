import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SimulationParams,
  CalculationLog,
  BoundaryWarning,
  ExportRecord,
  SimulationSession,
  DEFAULT_PARAMS,
  ExportType,
} from '../types';
import {
  calculateInduction,
  checkBoundaryConditions,
  generateId,
  calculateDataHash,
} from '../utils/calculator';

interface SimulationState {
  session: SimulationSession;
  currentResult: CalculationLog | null;
  selectedObject: 'coil' | 'magnet' | null;
  isPlaying: boolean;
  
  setParams: (params: Partial<SimulationParams>) => void;
  setDirection: (direction: 1 | -1) => void;
  toggleDirection: () => void;
  calculate: () => void;
  confirmWarning: (warningId: string) => void;
  selectObject: (obj: 'coil' | 'magnet' | null) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  recordExport: (type: ExportType) => Promise<void>;
  resetSession: () => void;
  verifyDataConsistency: () => Promise<boolean>;
}

function createNewSession(): SimulationSession {
  return {
    id: generateId(),
    params: { ...DEFAULT_PARAMS },
    calculationHistory: [],
    warnings: [],
    exportHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      session: createNewSession(),
      currentResult: null,
      selectedObject: null,
      isPlaying: true,
      
      setParams: (params) => {
        set((state) => {
          const newParams = { ...state.session.params, ...params };
          const warnings = checkBoundaryConditions(newParams);
          return {
            session: {
              ...state.session,
              params: newParams,
              warnings,
              updatedAt: Date.now(),
            },
          };
        });
        get().calculate();
      },
      
      setDirection: (direction) => {
        get().setParams({ direction });
      },
      
      toggleDirection: () => {
        const current = get().session.params.direction;
        get().setDirection(current === 1 ? -1 : 1);
      },
      
      calculate: () => {
        const result = calculateInduction(get().session.params);
        set((state) => ({
          currentResult: result,
          session: {
            ...state.session,
            calculationHistory: [...state.session.calculationHistory, result].slice(-50),
            updatedAt: Date.now(),
          },
        }));
      },
      
      confirmWarning: (warningId) => {
        set((state) => ({
          session: {
            ...state.session,
            warnings: state.session.warnings.map((w) =>
              w.id === warningId ? { ...w, confirmed: true } : w
            ),
          },
        }));
      },
      
      selectObject: (obj) => {
        set({ selectedObject: obj });
      },
      
      setPlaying: (playing) => {
        set({ isPlaying: playing });
      },
      
      togglePlaying: () => {
        set((state) => ({ isPlaying: !state.isPlaying }));
      },
      
      recordExport: async (type) => {
        const state = get();
        const hashData = {
          params: state.session.params,
          result: state.currentResult,
          timestamp: Date.now(),
        };
        const dataHash = await calculateDataHash(hashData);
        
        const exportRecord: ExportRecord = {
          id: generateId(),
          type,
          timestamp: Date.now(),
          dataHash,
        };
        
        set((state) => ({
          session: {
            ...state.session,
            exportHistory: [...state.session.exportHistory, exportRecord],
            updatedAt: Date.now(),
          },
        }));
      },
      
      resetSession: () => {
        set({
          session: createNewSession(),
          currentResult: null,
          selectedObject: null,
        });
        get().calculate();
      },
      
      verifyDataConsistency: async () => {
        const state = get();
        if (state.session.exportHistory.length === 0) return true;
        
        const lastExport = state.session.exportHistory[state.session.exportHistory.length - 1];
        const hashData = {
          params: state.session.params,
          result: state.currentResult,
          timestamp: lastExport.timestamp,
        };
        const currentHash = await calculateDataHash(hashData);
        
        return currentHash === lastExport.dataHash;
      },
    }),
    {
      name: 'electromagnetic-induction-session',
      onRehydrateStorage: () => (state) => {
        if (state && !state.currentResult) {
          state.calculate();
        }
      },
    }
  )
);
