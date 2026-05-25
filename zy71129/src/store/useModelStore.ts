
import { create } from 'zustand';
import { ModelElement, VersionInfo } from '../types/model';
import { VersionDiff, CompareViewState } from '../types/version';
import { allSampleModels, versions } from '../data/sampleModels';
import { compareVersions } from '../utils/versionDiff';

interface ModelState {
  elements: ModelElement[];
  versions: VersionInfo[];
  currentVersion: number;
  compareVersion: number | null;
  selectedElementId: string | null;
  loaded: boolean;
  compareView: CompareViewState;
  versionDiff: VersionDiff | null;
  
  loadSampleData: () => void;
  setCurrentVersion: (version: number) => void;
  setCompareVersion: (version: number | null) => void;
  setSelectedElement: (id: string | null) => void;
  toggleElementVisibility: (id: string) => void;
  getFilteredElements: () => ModelElement[];
  getElementsByVersion: (version: number) => ModelElement[];
  setCompareViewMode: (mode: CompareViewState['viewMode']) => void;
  setSyncViews: (sync: boolean) => void;
  setHighlightDiff: (highlight: boolean) => void;
  enableCompareMode: () => void;
  disableCompareMode: () => void;
  calculateVersionDiff: () => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  elements: [],
  versions: [],
  currentVersion: 1,
  compareVersion: null,
  selectedElementId: null,
  loaded: false,
  compareView: {
    enabled: false,
    viewMode: 'sideBySide',
    syncViews: true,
    highlightDiff: true
  },
  versionDiff: null,

  loadSampleData: () => {
    set({
      elements: allSampleModels,
      versions: versions,
      loaded: true
    });
  },

  setCurrentVersion: (version) => {
    set({ currentVersion: version });
    if (get().compareView.enabled) {
      get().calculateVersionDiff();
    }
  },

  setCompareVersion: (version) => {
    set({ compareVersion: version });
    if (get().compareView.enabled) {
      get().calculateVersionDiff();
    }
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
    const { elements, currentVersion, compareVersion, compareView } = get();
    const targetVersions = compareView.enabled && compareVersion
      ? [currentVersion, compareVersion]
      : [currentVersion];
    return elements.filter(el => targetVersions.includes(el.version) && el.visible);
  },

  getElementsByVersion: (version) => {
    const { elements } = get();
    return elements.filter(el => el.version === version && el.visible);
  },

  setCompareViewMode: (mode) => {
    set((state) => ({
      compareView: { ...state.compareView, viewMode: mode }
    }));
  },

  setSyncViews: (sync) => {
    set((state) => ({
      compareView: { ...state.compareView, syncViews: sync }
    }));
  },

  setHighlightDiff: (highlight) => {
    set((state) => ({
      compareView: { ...state.compareView, highlightDiff: highlight }
    }));
  },

  enableCompareMode: () => {
    const { versions, currentVersion } = get();
    const compareVer = versions.find(v => v.number !== currentVersion)?.number || (currentVersion > 1 ? currentVersion - 1 : currentVersion + 1);
    set((state) => ({
      compareView: { ...state.compareView, enabled: true },
      compareVersion: compareVer
    }));
    get().calculateVersionDiff();
  },

  disableCompareMode: () => {
    set((state) => ({
      compareView: { ...state.compareView, enabled: false },
      compareVersion: null,
      versionDiff: null
    }));
  },

  calculateVersionDiff: () => {
    const { elements, currentVersion, compareVersion } = get();
    if (!compareVersion) {
      set({ versionDiff: null });
      return;
    }
    
    const v1Elements = elements.filter(el => el.version === compareVersion);
    const v2Elements = elements.filter(el => el.version === currentVersion);
    const diff = compareVersions(v1Elements, v2Elements, compareVersion, currentVersion);
    set({ versionDiff: diff });
  }
}));
