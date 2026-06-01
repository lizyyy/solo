import { create } from 'zustand';
import { 
  DataPoint, 
  Metadata, 
  ValidationResult, 
  AnomalyConfig, 
  AnalysisSession 
} from '../types';
import { validateData } from '../utils/validation';
import { detectAnomalies, calculateStatistics } from '../utils/anomalyDetection';
import { defaultAnomalyConfig, defaultMetadata } from '../utils/sampleData';

interface AnalysisState {
  session: AnalysisSession | null;
  isLoading: boolean;
  error: string | null;
  
  createSession: (name: string) => void;
  loadData: (dataPoints: DataPoint[]) => void;
  updateMetadata: (metadata: Partial<Metadata>) => void;
  updateAnomalyConfig: (config: Partial<AnomalyConfig>) => void;
  runValidation: () => ValidationResult;
  runAnomalyDetection: () => DataPoint[];
  addSupplementaryNote: (note: string) => void;
  clearSession: () => void;
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

const STORAGE_KEY = 'centrifugal-force-analysis-session';

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  session: null,
  isLoading: false,
  error: null,

  createSession: (name: string) => {
    const now = Date.now();
    const newSession: AnalysisSession = {
      id: `session-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: now,
      updatedAt: now,
      dataPoints: [],
      metadata: { ...defaultMetadata },
      validation: { isValid: true, errors: [], warnings: [] },
      anomalyConfig: { ...defaultAnomalyConfig },
      hasSupplementaryNote: false
    };
    set({ session: newSession });
    get().saveToLocalStorage();
  },

  loadData: (dataPoints: DataPoint[]) => {
    set(state => {
      if (!state.session) return state;
      const validation = validateData(dataPoints);
      const pointsWithAnomalies = detectAnomalies(dataPoints, state.session.anomalyConfig);
      return {
        session: {
          ...state.session,
          dataPoints: pointsWithAnomalies,
          validation,
          updatedAt: Date.now()
        }
      };
    });
    get().saveToLocalStorage();
  },

  updateMetadata: (metadata: Partial<Metadata>) => {
    set(state => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          metadata: { ...state.session.metadata, ...metadata },
          updatedAt: Date.now()
        }
      };
    });
    get().saveToLocalStorage();
  },

  updateAnomalyConfig: (config: Partial<AnomalyConfig>) => {
    set(state => {
      if (!state.session) return state;
      const newConfig = { ...state.session.anomalyConfig, ...config };
      const pointsWithAnomalies = detectAnomalies(state.session.dataPoints, newConfig);
      return {
        session: {
          ...state.session,
          anomalyConfig: newConfig,
          dataPoints: pointsWithAnomalies,
          updatedAt: Date.now()
        }
      };
    });
    get().saveToLocalStorage();
  },

  runValidation: () => {
    const state = get();
    if (!state.session) {
      return { isValid: false, errors: [{ type: 'missing_value' as const, rowIndex: -1, message: '未创建会话', suggestion: '请先创建分析会话' }], warnings: [] };
    }
    const validation = validateData(state.session.dataPoints);
    set(s => ({
      session: s.session ? { ...s.session, validation } : null
    }));
    return validation;
  },

  runAnomalyDetection: () => {
    const state = get();
    if (!state.session) return [];
    const pointsWithAnomalies = detectAnomalies(state.session.dataPoints, state.session.anomalyConfig);
    set(s => ({
      session: s.session ? { ...s.session, dataPoints: pointsWithAnomalies, updatedAt: Date.now() } : null
    }));
    get().saveToLocalStorage();
    return pointsWithAnomalies;
  },

  addSupplementaryNote: (note: string) => {
    set(state => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          hasSupplementaryNote: true,
          dataBeforeSupplementary: state.session.dataBeforeSupplementary || state.session.dataPoints.map(p => ({ ...p })),
          metadata: {
            ...state.session.metadata,
            supplementaryNote: note
          },
          updatedAt: Date.now()
        }
      };
    });
    get().saveToLocalStorage();
  },

  clearSession: () => {
    set({ session: null });
    localStorage.removeItem(STORAGE_KEY);
  },

  loadFromLocalStorage: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        set({ session });
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  },

  saveToLocalStorage: () => {
    try {
      const { session } = get();
      if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }
}));

export { calculateStatistics };
