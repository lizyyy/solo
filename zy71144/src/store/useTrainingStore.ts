import { create } from 'zustand';
import type {
  PathNode,
  TrainingParams,
  CalculationResult,
  TrainingMode,
  TrainingSession,
  Point3D,
} from '../types';

const STORAGE_KEY = 'fire-hose-training-sessions';

const DEFAULT_PARAMS: TrainingParams = {
  hoseDiameter: 65,
  maxHoseLength: 100,
  maxCorners: 8,
  minPressure: 0.25,
  flowRate: 5,
};

const loadSessionsFromStorage = (): TrainingSession[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load sessions from localStorage:', e);
  }
  return [];
};

const saveSessionsToStorage = (sessions: TrainingSession[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save sessions to localStorage:', e);
  }
};

interface TrainingState {
  mode: TrainingMode;
  path: PathNode[];
  params: TrainingParams;
  result: CalculationResult | null;
  selectedNodeId: string | null;
  playbackIndex: number;
  isPlaying: boolean;
  sessions: TrainingSession[];
  currentSessionId: string | null;
  showReport: boolean;

  setMode: (mode: TrainingMode) => void;
  addNode: (position: Point3D, type?: PathNode['type']) => void;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: Point3D) => void;
  selectNode: (nodeId: string | null) => void;
  setParams: (params: Partial<TrainingParams>) => void;
  setResult: (result: CalculationResult | null) => void;
  resetPath: () => void;
  resetAll: () => void;

  setPlaybackIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;

  saveSession: (buildingId: string, buildingName: string) => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  setShowReport: (show: boolean) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const initialSessions = loadSessionsFromStorage();

export const useTrainingStore = create<TrainingState>((set, get) => ({
  mode: 'edit',
  path: [],
  params: DEFAULT_PARAMS,
  result: null,
  selectedNodeId: null,
  playbackIndex: 0,
  isPlaying: false,
  sessions: initialSessions,
  currentSessionId: null,
  showReport: false,

  setMode: (mode) => set({ mode }),

  addNode: (position, type = 'corner') => {
    const { path } = get();
    const nodeType = path.length === 0 ? 'start' : type;
    const newNode: PathNode = {
      id: generateId(),
      position,
      type: nodeType,
      timestamp: Date.now(),
    };
    set({ path: [...path, newNode] });
  },

  removeNode: (nodeId) => {
    const { path } = get();
    const newPath = path.filter((n) => n.id !== nodeId);
    if (newPath.length > 0 && newPath[0].type !== 'start') {
      newPath[0].type = 'start';
    }
    set({ path: newPath, selectedNodeId: null });
  },

  updateNodePosition: (nodeId, position) => {
    const { path } = get();
    set({
      path: path.map((n) =>
        n.id === nodeId ? { ...n, position } : n
      ),
    });
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setParams: (params) =>
    set((state) => ({ params: { ...state.params, ...params } })),

  setResult: (result) => set({ result }),

  resetPath: () => set({ path: [], result: null, selectedNodeId: null }),

  resetAll: () =>
    set({
      path: [],
      result: null,
      selectedNodeId: null,
      playbackIndex: 0,
      isPlaying: false,
      mode: 'edit',
    }),

  setPlaybackIndex: (index) => set({ playbackIndex: index }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  saveSession: (buildingId, buildingName) => {
    const { path, params, result } = get();
    if (!result || path.length < 2) return;

    const session: TrainingSession = {
      id: generateId(),
      startTime: path[0].timestamp,
      endTime: Date.now(),
      buildingId,
      buildingName,
      path,
      params,
      result,
    };

    set((state) => {
      const newSessions = [...state.sessions, session];
      saveSessionsToStorage(newSessions);
      return {
        sessions: newSessions,
        currentSessionId: session.id,
      };
    });
  },

  loadSession: (sessionId) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      set({
        path: session.path,
        params: session.params,
        result: session.result,
        currentSessionId: session.id,
        mode: 'edit',
      });
    }
  },

  deleteSession: (sessionId) => {
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== sessionId);
      saveSessionsToStorage(newSessions);
      return {
        sessions: newSessions,
        currentSessionId:
          state.currentSessionId === sessionId ? null : state.currentSessionId,
      };
    });
  },

  setShowReport: (show) => set({ showReport: show }),
}));
