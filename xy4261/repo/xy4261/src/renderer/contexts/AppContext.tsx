import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { 
  Project, 
  Cue, 
  Fixture, 
  PatchEntry, 
  ValidationError,
  ProjectSettings 
} from '../../shared/models/types';
import { createDefaultProject, updateCue } from '../../shared/models';
import { RuleEngineResult, runAllChecks } from '../../shared/services/ruleEngine';

interface AppState {
  project: Project;
  ruleResult: RuleEngineResult | null;
  selectedCueId: string | null;
  isDirty: boolean;
  lastSavedPath: string | null;
  lastSavedFileName: string | null;
}

type AppAction =
  | { type: 'SET_PROJECT'; payload: Project }
  | { type: 'UPDATE_CUE'; payload: { cueId: string; updates: Partial<Cue> } }
  | { type: 'ADD_CUE'; payload: Cue }
  | { type: 'DELETE_CUE'; payload: string }
  | { type: 'ADD_FIXTURE'; payload: Fixture }
  | { type: 'UPDATE_FIXTURE'; payload: { fixtureId: string; updates: Partial<Fixture> } }
  | { type: 'DELETE_FIXTURE'; payload: string }
  | { type: 'ADD_PATCH'; payload: PatchEntry }
  | { type: 'UPDATE_PATCH'; payload: { patchId: string; updates: Partial<PatchEntry> } }
  | { type: 'DELETE_PATCH'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<ProjectSettings> }
  | { type: 'SELECT_CUE'; payload: string | null }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_SAVED_PATH'; payload: { path: string | null; fileName: string | null } }
  | { type: 'RUN_VALIDATION' }
  | { type: 'RESET' };

const initialState: AppState = {
  project: createDefaultProject('新演出项目'),
  ruleResult: null,
  selectedCueId: null,
  isDirty: false,
  lastSavedPath: null,
  lastSavedFileName: null
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECT': {
      return {
        ...state,
        project: action.payload,
        ruleResult: runAllChecks(
          action.payload.fixtures,
          action.payload.patches,
          action.payload.cues,
          action.payload.settings
        ),
        isDirty: false,
        selectedCueId: null
      };
    }

    case 'UPDATE_CUE': {
      const newCues = state.project.cues.map(cue => {
        if (cue.id === action.payload.cueId) {
          return updateCue(cue, action.payload.updates);
        }
        return cue;
      });
      const newProject = {
        ...state.project,
        cues: newCues,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'ADD_CUE': {
      const newCues = [...state.project.cues, action.payload];
      const newProject = {
        ...state.project,
        cues: newCues,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'DELETE_CUE': {
      const newCues = state.project.cues.filter(c => c.id !== action.payload);
      const newProject = {
        ...state.project,
        cues: newCues,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true,
        selectedCueId: state.selectedCueId === action.payload ? null : state.selectedCueId
      };
    }

    case 'ADD_FIXTURE': {
      const newFixtures = [...state.project.fixtures, action.payload];
      const newProject = {
        ...state.project,
        fixtures: newFixtures,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'UPDATE_FIXTURE': {
      const newFixtures = state.project.fixtures.map(f => {
        if (f.id === action.payload.fixtureId) {
          return { ...f, ...action.payload.updates };
        }
        return f;
      });
      const newProject = {
        ...state.project,
        fixtures: newFixtures,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'DELETE_FIXTURE': {
      const newFixtures = state.project.fixtures.filter(f => f.id !== action.payload);
      const newPatches = state.project.patches.filter(p => p.fixtureId !== action.payload);
      const newCues = state.project.cues.map(cue => ({
        ...cue,
        activeFixtures: cue.activeFixtures.filter(id => id !== action.payload)
      }));
      const newProject = {
        ...state.project,
        fixtures: newFixtures,
        patches: newPatches,
        cues: newCues,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'ADD_PATCH': {
      const newPatches = [...state.project.patches, action.payload];
      const newProject = {
        ...state.project,
        patches: newPatches,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'UPDATE_PATCH': {
      const newPatches = state.project.patches.map(p => {
        if (p.id === action.payload.patchId) {
          return { ...p, ...action.payload.updates };
        }
        return p;
      });
      const newProject = {
        ...state.project,
        patches: newPatches,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'DELETE_PATCH': {
      const newPatches = state.project.patches.filter(p => p.id !== action.payload);
      const newProject = {
        ...state.project,
        patches: newPatches,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'UPDATE_SETTINGS': {
      const newSettings = {
        ...state.project.settings,
        ...action.payload
      };
      const newProject = {
        ...state.project,
        settings: newSettings,
        updatedAt: Date.now()
      };
      return {
        ...state,
        project: newProject,
        ruleResult: runAllChecks(
          newProject.fixtures,
          newProject.patches,
          newProject.cues,
          newProject.settings
        ),
        isDirty: true
      };
    }

    case 'SELECT_CUE':
      return {
        ...state,
        selectedCueId: action.payload
      };

    case 'SET_DIRTY':
      return {
        ...state,
        isDirty: action.payload
      };

    case 'SET_SAVED_PATH':
      return {
        ...state,
        lastSavedPath: action.payload.path,
        lastSavedFileName: action.payload.fileName
      };

    case 'RUN_VALIDATION':
      return {
        ...state,
        ruleResult: runAllChecks(
          state.project.fixtures,
          state.project.patches,
          state.project.cues,
          state.project.settings
        )
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setProject: (project: Project) => void;
  updateCue: (cueId: string, updates: Partial<Cue>) => void;
  addCue: (cue: Cue) => void;
  deleteCue: (cueId: string) => void;
  addFixture: (fixture: Fixture) => void;
  updateFixture: (fixtureId: string, updates: Partial<Fixture>) => void;
  deleteFixture: (fixtureId: string) => void;
  addPatch: (patch: PatchEntry) => void;
  updatePatch: (patchId: string, updates: Partial<PatchEntry>) => void;
  deletePatch: (patchId: string) => void;
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  selectCue: (cueId: string | null) => void;
  runValidation: () => void;
  resetProject: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setProject = useCallback((project: Project) => {
    dispatch({ type: 'SET_PROJECT', payload: project });
  }, []);

  const updateCue = useCallback((cueId: string, updates: Partial<Cue>) => {
    dispatch({ type: 'UPDATE_CUE', payload: { cueId, updates } });
  }, []);

  const addCue = useCallback((cue: Cue) => {
    dispatch({ type: 'ADD_CUE', payload: cue });
  }, []);

  const deleteCue = useCallback((cueId: string) => {
    dispatch({ type: 'DELETE_CUE', payload: cueId });
  }, []);

  const addFixture = useCallback((fixture: Fixture) => {
    dispatch({ type: 'ADD_FIXTURE', payload: fixture });
  }, []);

  const updateFixture = useCallback((fixtureId: string, updates: Partial<Fixture>) => {
    dispatch({ type: 'UPDATE_FIXTURE', payload: { fixtureId, updates } });
  }, []);

  const deleteFixture = useCallback((fixtureId: string) => {
    dispatch({ type: 'DELETE_FIXTURE', payload: fixtureId });
  }, []);

  const addPatch = useCallback((patch: PatchEntry) => {
    dispatch({ type: 'ADD_PATCH', payload: patch });
  }, []);

  const updatePatch = useCallback((patchId: string, updates: Partial<PatchEntry>) => {
    dispatch({ type: 'UPDATE_PATCH', payload: { patchId, updates } });
  }, []);

  const deletePatch = useCallback((patchId: string) => {
    dispatch({ type: 'DELETE_PATCH', payload: patchId });
  }, []);

  const updateSettings = useCallback((settings: Partial<ProjectSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  }, []);

  const selectCue = useCallback((cueId: string | null) => {
    dispatch({ type: 'SELECT_CUE', payload: cueId });
  }, []);

  const runValidation = useCallback(() => {
    dispatch({ type: 'RUN_VALIDATION' });
  }, []);

  const resetProject = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: AppContextType = {
    state,
    dispatch,
    setProject,
    updateCue,
    addCue,
    deleteCue,
    addFixture,
    updateFixture,
    deleteFixture,
    addPatch,
    updatePatch,
    deletePatch,
    updateSettings,
    selectCue,
    runValidation,
    resetProject
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
