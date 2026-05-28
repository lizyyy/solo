import { create } from 'zustand';
import type { AppState, AppActions, IssueTrack } from '@/types';
import {
  initialEnergyLevels,
  initialTransitions,
  initialSpectrumLines,
  initialExternalField,
  initialIssueTracks
} from '@/data/mockData';
import { runAllValidations } from '@/utils/validation';

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set, get) => ({
  energyLevels: initialEnergyLevels,
  transitions: initialTransitions,
  spectrumLines: initialSpectrumLines,
  externalField: initialExternalField,
  selectedLevel: null,
  activeTransition: null,
  validationResults: runAllValidations(initialEnergyLevels, initialTransitions, initialSpectrumLines),
  issueTracks: initialIssueTracks,
  screenshots: [],

  selectLevel: (id: number | null) => {
    set({ selectedLevel: id });
    
    if (id !== null) {
      const { transitions } = get();
      const relatedTransition = transitions.find(
        t => t.from_level === id || t.to_level === id
      );
      set({ activeTransition: relatedTransition?.id || null });
    } else {
      set({ activeTransition: null });
    }
  },

  setActiveTransition: (id: number | null) => {
    set({ activeTransition: id });
  },

  updateEnergyLevel: (id: number, updates: Partial<AppState['energyLevels'][0]>) => {
    set(state => ({
      energyLevels: state.energyLevels.map(level =>
        level.id === id ? { ...level, ...updates } : level
      )
    }));
    get().validateData();
  },

  updateTransition: (id: number, updates: Partial<AppState['transitions'][0]>) => {
    set(state => ({
      transitions: state.transitions.map(t =>
        t.id === id ? { ...t, ...updates } : t
      )
    }));
    get().validateData();
  },

  updateSpectrumLine: (id: number, updates: Partial<AppState['spectrumLines'][0]>) => {
    set(state => ({
      spectrumLines: state.spectrumLines.map(line =>
        line.id === id ? { ...line, ...updates } : line
      )
    }));
    get().validateData();
  },

  updateExternalField: (updates: Partial<AppState['externalField']>) => {
    set(state => ({
      externalField: { ...state.externalField, ...updates }
    }));
  },

  validateData: () => {
    const { energyLevels, transitions, spectrumLines } = get();
    const results = runAllValidations(energyLevels, transitions, spectrumLines);
    set({ validationResults: results });
  },

  addIssueTrack: (issue: Omit<IssueTrack, 'id' | 'discovered_at'>) => {
    set(state => ({
      issueTracks: [
        ...state.issueTracks,
        {
          ...issue,
          id: `issue-${Date.now()}`,
          discovered_at: new Date()
        }
      ]
    }));
  },

  updateIssueTrack: (id: string, updates: Partial<IssueTrack>) => {
    set(state => ({
      issueTracks: state.issueTracks.map(issue =>
        issue.id === id ? { ...issue, ...updates } : issue
      )
    }));
  },

  addScreenshot: (screenshot: Omit<AppState['screenshots'][0], 'id' | 'created_at'>) => {
    set(state => ({
      screenshots: [
        ...state.screenshots,
        {
          ...screenshot,
          id: `screenshot-${Date.now()}`,
          created_at: new Date()
        }
      ]
    }));
  },

  resetToOriginal: (dataType: 'energy' | 'transition' | 'spectrum', id: number) => {
    const state = get();
    
    if (dataType === 'energy') {
      const level = state.energyLevels.find(l => l.id === id);
      if (level?.original_value) {
        const original = JSON.parse(level.original_value);
        get().updateEnergyLevel(id, original);
      }
    } else if (dataType === 'transition') {
      const transition = state.transitions.find(t => t.id === id);
      if (transition?.original_value) {
        const original = JSON.parse(transition.original_value);
        get().updateTransition(id, original);
      }
    } else if (dataType === 'spectrum') {
      const line = state.spectrumLines.find(l => l.id === id);
      if (line?.original_value) {
        const original = JSON.parse(line.original_value);
        get().updateSpectrumLine(id, original);
      }
    }
  }
}));
