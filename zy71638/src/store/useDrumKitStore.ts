import { create } from 'zustand';
import {
  Session,
  DrumPiece,
  Microphone,
  Position3D,
  Rotation3D,
  AcousticAnalysis,
  DrumKitStore,
  ValidationError,
  SavedSession,
} from '@/types';
import {
  DEFAULT_DRUM_PIECES,
  DEFAULT_MICROPHONES,
  DRUM_PIECE_NAMES,
  DRUM_PIECE_SIZES,
} from '@/utils/constants';
import { generateId } from '@/utils/validation';

function createDefaultSession(): Session {
  const now = new Date().toISOString();
  
  const drumPieces: DrumPiece[] = DEFAULT_DRUM_PIECES.map(dp => ({
    id: generateId(),
    type: dp.type,
    name: DRUM_PIECE_NAMES[dp.type],
    position: { ...dp.position },
    rotationY: dp.rotationY,
    size: DRUM_PIECE_SIZES[dp.type],
  }));
  
  const microphones: Microphone[] = DEFAULT_MICROPHONES.map(m => {
    const drumPiece = drumPieces.find(dp => dp.type === m.drumPieceType);
    return {
      id: generateId(),
      drumPieceId: drumPiece?.id || drumPieces[0].id,
      name: m.name,
      model: m.model,
      position: { ...m.position },
      rotation: { ...m.rotation },
      polarPattern: m.polarPattern,
      phaseInverted: m.phaseInverted || false,
      distanceUnit: m.distanceUnit,
      gain: m.gain,
    };
  });
  
  return {
    id: generateId(),
    name: '默认鼓组拾音方案',
    createdAt: now,
    updatedAt: now,
    drumPieces,
    microphones,
    recordingNotes: '',
  };
}

const initialAnalysis: AcousticAnalysis = {
  phaseRelations: [],
  crosstalkMatrix: [],
  distanceMatrix: {},
  errors: [],
};

export const useDrumKitStore = create<DrumKitStore & {
  setSessionName: (name: string) => void;
  setRecordingNotes: (notes: string) => void;
  selectMicrophone: (micId: string | null) => void;
  selectDrumPiece: (drumId: string | null) => void;
  updateMicrophonePosition: (micId: string, position: Position3D) => void;
  updateMicrophoneRotation: (micId: string, rotation: Rotation3D) => void;
  updateMicrophone: (micId: string, updates: Partial<Microphone>) => void;
  updateDrumPiecePosition: (drumId: string, position: Position3D) => void;
  updateDrumPiece: (drumId: string, updates: Partial<DrumPiece>) => void;
  addMicrophone: (drumPieceId: string) => void;
  removeMicrophone: (micId: string) => void;
  setAnalysis: (analysis: AcousticAnalysis) => void;
  addError: (error: ValidationError) => void;
  clearErrors: () => void;
  toggleCrosstalk: () => void;
  togglePhaseLines: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  saveSession: (name: string, thumbnail?: string) => void;
  loadSession: (sessionId: string) => boolean;
  deleteSavedSession: (sessionId: string) => void;
  getSavedSessions: () => SavedSession[];
  resetSession: () => void;
  importSession: (sessionData: string) => boolean;
}>((set, get) => ({
  session: createDefaultSession(),
  selectedMicId: null,
  selectedDrumId: null,
  analysis: initialAnalysis,
  isLoading: false,
  showCrosstalk: true,
  showPhaseLines: true,
  leftPanelOpen: true,
  rightPanelOpen: true,

  setSessionName: (name: string) => set(state => ({
    session: {
      ...state.session,
      name,
      updatedAt: new Date().toISOString(),
    },
  })),

  setRecordingNotes: (notes: string) => set(state => ({
    session: {
      ...state.session,
      recordingNotes: notes,
      updatedAt: new Date().toISOString(),
    },
  })),

  selectMicrophone: (micId: string | null) => set({
    selectedMicId: micId,
    selectedDrumId: null,
  }),

  selectDrumPiece: (drumId: string | null) => set({
    selectedDrumId: drumId,
    selectedMicId: null,
  }),

  updateMicrophonePosition: (micId: string, position: Position3D) => set(state => ({
    session: {
      ...state.session,
      updatedAt: new Date().toISOString(),
      microphones: state.session.microphones.map(m =>
        m.id === micId ? { ...m, position: { ...position } } : m
      ),
    },
  })),

  updateMicrophoneRotation: (micId: string, rotation: Rotation3D) => set(state => ({
    session: {
      ...state.session,
      updatedAt: new Date().toISOString(),
      microphones: state.session.microphones.map(m =>
        m.id === micId ? { ...m, rotation: { ...rotation } } : m
      ),
    },
  })),

  updateMicrophone: (micId: string, updates: Partial<Microphone>) => set(state => ({
    session: {
      ...state.session,
      updatedAt: new Date().toISOString(),
      microphones: state.session.microphones.map(m =>
        m.id === micId ? { ...m, ...updates } : m
      ),
    },
  })),

  updateDrumPiecePosition: (drumId: string, position: Position3D) => set(state => ({
    session: {
      ...state.session,
      updatedAt: new Date().toISOString(),
      drumPieces: state.session.drumPieces.map(d =>
        d.id === drumId ? { ...d, position: { ...position } } : d
      ),
    },
  })),

  updateDrumPiece: (drumId: string, updates: Partial<DrumPiece>) => set(state => ({
    session: {
      ...state.session,
      updatedAt: new Date().toISOString(),
      drumPieces: state.session.drumPieces.map(d =>
        d.id === drumId ? { ...d, ...updates } : d
      ),
    },
  })),

  addMicrophone: (drumPieceId: string) => set(state => {
    const drumPiece = state.session.drumPieces.find(d => d.id === drumPieceId);
    const micCount = state.session.microphones.filter(m => m.drumPieceId === drumPieceId).length;
    const pieceName = drumPiece ? DRUM_PIECE_NAMES[drumPiece.type] : '鼓件';
    
    const newMic: Microphone = {
      id: generateId(),
      drumPieceId,
      name: `${pieceName}麦${micCount + 1}`,
      model: 'Shure SM57',
      position: {
        x: drumPiece ? drumPiece.position.x + 0.3 : 0,
        y: drumPiece ? drumPiece.position.y + 0.3 : 1,
        z: drumPiece ? drumPiece.position.z + 0.3 : 0,
      },
      rotation: { x: -0.5, y: 0, z: 0 },
      polarPattern: 'cardioid',
      phaseInverted: false,
      distanceUnit: 'cm',
      gain: 0,
    };
    
    return {
      session: {
        ...state.session,
        updatedAt: new Date().toISOString(),
        microphones: [...state.session.microphones, newMic],
      },
      selectedMicId: newMic.id,
    };
  }),

  removeMicrophone: (micId: string) => set(state => ({
    session: {
      ...state.session,
      updatedAt: new Date().toISOString(),
      microphones: state.session.microphones.filter(m => m.id !== micId),
    },
    selectedMicId: state.selectedMicId === micId ? null : state.selectedMicId,
  })),

  setAnalysis: (analysis: AcousticAnalysis) => set({ analysis }),

  addError: (error: ValidationError) => set(state => ({
    analysis: {
      ...state.analysis,
      errors: [...state.analysis.errors, error],
    },
  })),

  clearErrors: () => set(state => ({
    analysis: {
      ...state.analysis,
      errors: [],
    },
  })),

  toggleCrosstalk: () => set(state => ({ showCrosstalk: !state.showCrosstalk })),
  togglePhaseLines: () => set(state => ({ showPhaseLines: !state.showPhaseLines })),
  toggleLeftPanel: () => set(state => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () => set(state => ({ rightPanelOpen: !state.rightPanelOpen })),

  saveSession: (name: string, thumbnail?: string) => {
    const state = get();
    const savedSessions = state.getSavedSessions();
    const now = new Date().toISOString();
    
    const savedSession: SavedSession = {
      id: generateId(),
      name,
      createdAt: now,
      session: JSON.parse(JSON.stringify(state.session)),
      thumbnail,
    };
    
    savedSessions.push(savedSession);
    localStorage.setItem('drumKit_sessions', JSON.stringify(savedSessions));
  },

  loadSession: (sessionId: string): boolean => {
    const savedSessions = get().getSavedSessions();
    const saved = savedSessions.find(s => s.id === sessionId);
    
    if (!saved) return false;
    
    set({
      session: JSON.parse(JSON.stringify(saved.session)),
      selectedMicId: null,
      selectedDrumId: null,
    });
    
    return true;
  },

  deleteSavedSession: (sessionId: string) => {
    const savedSessions = get().getSavedSessions().filter(s => s.id !== sessionId);
    localStorage.setItem('drumKit_sessions', JSON.stringify(savedSessions));
  },

  getSavedSessions: (): SavedSession[] => {
    try {
      const data = localStorage.getItem('drumKit_sessions');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  resetSession: () => set({
    session: createDefaultSession(),
    selectedMicId: null,
    selectedDrumId: null,
    analysis: initialAnalysis,
  }),

  importSession: (sessionData: string): boolean => {
    try {
      const parsed = JSON.parse(sessionData);
      if (!parsed.drumPieces || !parsed.microphones) {
        return false;
      }
      
      set({
        session: {
          ...parsed,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        selectedMicId: null,
        selectedDrumId: null,
      });
      
      return true;
    } catch {
      return false;
    }
  },
}));
