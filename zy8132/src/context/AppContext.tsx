import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ProjectState, Subtitle, AudioMarker, ProgramSegment, ValidationIssue } from '../types';
import { validateSubtitles } from '../validators/subtitleValidator';
import { saveProject, loadProject } from '../store/persistence';

interface AppState extends ProjectState {}

type AppAction =
  | { type: 'SET_AUDIO_MARKERS'; payload: AudioMarker[] }
  | { type: 'SET_SUBTITLES'; payload: Subtitle[] }
  | { type: 'SET_PROGRAM_SEGMENTS'; payload: ProgramSegment[] }
  | { type: 'UPDATE_SUBTITLE'; payload: { id: string; updates: Partial<Subtitle> } }
  | { type: 'SELECT_SUBTITLE'; payload: string | undefined }
  | { type: 'VALIDATE' }
  | { type: 'LOAD_PROJECT'; payload: ProjectState }
  | { type: 'RESET_PROJECT' }
  | { type: 'SET_PROJECT_NAME'; payload: string }
  | { type: 'AUTO_FIX_SUBTITLE'; payload: string }
  | { type: 'AUTO_FIX_ALL' };

const initialState: AppState = {
  audioMarkers: [],
  subtitles: [],
  programSegments: [],
  validationIssues: [],
  filesLoaded: {
    audioMarkers: false,
    subtitles: false,
    programSegments: false,
  },
  selectedSubtitleId: undefined,
  isModified: false,
  projectName: undefined,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_AUDIO_MARKERS':
      return {
        ...state,
        audioMarkers: action.payload,
        filesLoaded: { ...state.filesLoaded, audioMarkers: true },
        isModified: true,
      };

    case 'SET_SUBTITLES':
      return {
        ...state,
        subtitles: action.payload,
        filesLoaded: { ...state.filesLoaded, subtitles: true },
        isModified: true,
      };

    case 'SET_PROGRAM_SEGMENTS':
      return {
        ...state,
        programSegments: action.payload,
        filesLoaded: { ...state.filesLoaded, programSegments: true },
        isModified: true,
      };

    case 'UPDATE_SUBTITLE': {
      const updatedSubtitles = state.subtitles.map((sub) =>
        sub.id === action.payload.id
          ? { ...sub, ...action.payload.updates, isModified: true }
          : sub
      );
      return {
        ...state,
        subtitles: updatedSubtitles,
        isModified: true,
      };
    }

    case 'SELECT_SUBTITLE':
      return {
        ...state,
        selectedSubtitleId: action.payload,
      };

    case 'VALIDATE': {
      const issues = validateSubtitles(
        state.subtitles,
        state.audioMarkers,
        state.programSegments
      );
      return {
        ...state,
        validationIssues: issues,
      };
    }

    case 'LOAD_PROJECT':
      return {
        ...action.payload,
      };

    case 'RESET_PROJECT':
      return {
        ...initialState,
      };

    case 'SET_PROJECT_NAME':
      return {
        ...state,
        projectName: action.payload,
        isModified: true,
      };

    case 'AUTO_FIX_SUBTITLE': {
      const subtitle = state.subtitles.find(s => s.id === action.payload);
      if (!subtitle) return state;

      const speechMarkers = state.audioMarkers.filter(m => m.type === 'speech');
      let newStartTime = subtitle.startTime;
      let newEndTime = subtitle.endTime;

      for (const marker of speechMarkers) {
        const overlapStart = Math.max(subtitle.startTime, marker.startTime);
        const overlapEnd = Math.min(subtitle.endTime, marker.endTime);
        
        if (overlapEnd > overlapStart) {
          if (subtitle.startTime < marker.startTime) {
            newStartTime = marker.startTime;
          }
          if (subtitle.endTime > marker.endTime) {
            newEndTime = marker.endTime;
          }
        }
      }

      if (newStartTime !== subtitle.startTime || newEndTime !== subtitle.endTime) {
        const updatedSubtitles = state.subtitles.map((sub) =>
          sub.id === action.payload
            ? { ...sub, startTime: newStartTime, endTime: newEndTime, isModified: true }
            : sub
        );

        const newIssues = validateSubtitles(
          updatedSubtitles,
          state.audioMarkers,
          state.programSegments
        );

        return {
          ...state,
          subtitles: updatedSubtitles,
          validationIssues: newIssues,
          isModified: true,
        };
      }
      return state;
    }

    case 'AUTO_FIX_ALL': {
      const speechMarkers = state.audioMarkers.filter(m => m.type === 'speech');
      
      const updatedSubtitles = state.subtitles.map((subtitle) => {
        let newStartTime = subtitle.startTime;
        let newEndTime = subtitle.endTime;
        let modified = false;

        for (const marker of speechMarkers) {
          const overlapStart = Math.max(subtitle.startTime, marker.startTime);
          const overlapEnd = Math.min(subtitle.endTime, marker.endTime);
          
          if (overlapEnd > overlapStart) {
            if (subtitle.startTime < marker.startTime) {
              newStartTime = marker.startTime;
              modified = true;
            }
            if (subtitle.endTime > marker.endTime) {
              newEndTime = marker.endTime;
              modified = true;
            }
          }
        }

        if (modified) {
          return { ...subtitle, startTime: newStartTime, endTime: newEndTime, isModified: true };
        }
        return subtitle;
      });

      const newIssues = validateSubtitles(
        updatedSubtitles,
        state.audioMarkers,
        state.programSegments
      );

      return {
        ...state,
        subtitles: updatedSubtitles,
        validationIssues: newIssues,
        isModified: true,
      };
    }

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const savedProject = loadProject();
    if (savedProject) {
      dispatch({ type: 'LOAD_PROJECT', payload: savedProject });
    }
  }, []);

  useEffect(() => {
    if (state.isModified) {
      saveProject(state);
    }
  }, [state.isModified, state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
