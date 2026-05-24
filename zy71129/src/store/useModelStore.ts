
import { create } from 'zustand';
import { ModelElement, VersionInfo } from '../types/model';
import { allSampleModels, versions } from '../data/sampleModels';

interface ModelState {
  elements: ModelElement[];
  versions: VersionInfo[];
  currentVersion: number;
  compareVersion: number | null;
  selectedElementId: string | null;
  loaded: boolean;
  
  loadSampleData: () => void;
  setCurrentVersion: (version: number) => void;
  setCompareVersion: (version: number | null) => void;
  setSelectedElement: (id: string | null) => void;
  toggleElementVisibility: (id: string) => void;
  getFilteredElements: () => ModelElement[];
}

export const useModelStore = create<ModelState>((set, get) => ({
  elements: [],
  versions: [],
  currentVersion: 1,
  compareVersion: null,
  selectedElementId: null,
  loaded: false,

  loadSampleData: () => {
    set({
      elements: allSampleModels,
      versions: versions,
      loaded: true
    });
  },

  setCurrentVersion: (version) => {
    set({ currentVersion: version });
  },

  setCompareVersion: (version) => {
    set({ compareVersion: version });
  },

  setSelectedElement: (id) => {
    set({ selectedElementId: id });
  },

  toggleElementVisibility: (id) => {
    set((state) => ({
      elements: state.elements.map(el =>
        el.id === id ? { ...el, visible: !el.visible } : el
      )
    }));
  },

  getFilteredElements: () => {
    const { elements, currentVersion, compareVersion } = get();
    const targetVersions = compareVersion 
      ? [currentVersion, compareVersion]
      : [currentVersion];
    return elements.filter(el => targetVersions.includes(el.version) && el.visible);
  }
}));
