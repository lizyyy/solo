import { create } from 'zustand';
import type {
  BandRequirement,
  VersionRecord,
  FilterSnapshot,
  ExportRecord,
  Channel,
  Monitor,
  FilterCriteria,
  AppState
} from '@/types';
import { RequirementStatus } from '@/types';
import { generateId } from '@/utils/helpers';
import {
  detectAllConflicts,
  detectGlobalChannelConflicts,
  hasUnresolvedConflicts
} from '@/utils/conflictDetector';
import {
  createVersion,
  compareVersions,
  generateChangeSummary,
  getVersionsForRequirement
} from '@/utils/versioning';
import { loadPersistedState, persistState, PersistedState } from '@/utils/storage';
import { getFullMockData } from '@/utils/mockData';

interface AppStore extends AppState {
  isLoaded: boolean;
  isSaving: boolean;
  lastSaved: string | null;

  initializeStore: () => void;
  loadMockData: () => void;
  clearAllData: () => void;

  addRequirement: (req: Omit<BandRequirement, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'conflicts' | 'status'>) => void;
  updateRequirement: (id: string, updates: Partial<BandRequirement>, changeReason: string) => void;
  deleteRequirement: (id: string) => void;
  getRequirementById: (id: string) => BandRequirement | undefined;
  getFilteredRequirements: () => BandRequirement[];

  runConflictDetection: () => void;
  resolveConflict: (requirementId: string, conflictId: string) => void;

  setCurrentFilters: (filters: Partial<FilterCriteria>) => void;
  resetFilters: () => void;
  saveFilterSnapshot: (name: string) => void;
  deleteFilterSnapshot: (id: string) => void;
  applyFilterSnapshot: (id: string) => void;

  addExportRecord: (record: ExportRecord) => void;

  getVersionsForRequirement: (requirementId: string) => VersionRecord[];
  compareVersions: (v1: BandRequirement, v2: BandRequirement) => ReturnType<typeof compareVersions>;

  setSelectedVersion: (version: number | null) => void;

  updateGlobalChannel: (channel: Channel) => void;
  updateGlobalMonitor: (monitor: Monitor) => void;
}

function getInitialState(): AppState {
  return {
    requirements: [],
    versions: [],
    filterSnapshots: [],
    exportHistory: [],
    globalChannels: [],
    globalMonitors: [],
    currentFilters: {},
    selectedVersion: null
  };
}

function persistAllState(state: PersistedState): void {
  try {
    persistState(state);
  } catch (error) {
    console.error('Failed to persist state:', error);
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...getInitialState(),
  isLoaded: false,
  isSaving: false,
  lastSaved: null,

  initializeStore: () => {
    const persisted = loadPersistedState();
    
    let stateToUse: PersistedState;
    if (persisted.requirements.length === 0) {
      stateToUse = getFullMockData();
    } else {
      stateToUse = persisted;
    }

    const { requirements, ...rest } = stateToUse;
    const updatedRequirements = requirements.map((req) => {
      const conflicts = detectAllConflicts(req, requirements);
      const hasErrors = hasUnresolvedConflicts(conflicts);
      return {
        ...req,
        conflicts,
        status: hasErrors ? RequirementStatus.PENDING : RequirementStatus.NORMAL
      };
    });

    set({
      requirements: updatedRequirements,
      ...rest,
      isLoaded: true,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: updatedRequirements,
      versions: rest.versions,
      filterSnapshots: rest.filterSnapshots,
      exportHistory: rest.exportHistory,
      globalChannels: rest.globalChannels,
      globalMonitors: rest.globalMonitors
    });
  },

  loadMockData: () => {
    const mockData = getFullMockData();
    const updatedRequirements = mockData.requirements.map((req) => {
      const conflicts = detectAllConflicts(req, mockData.requirements);
      const hasErrors = hasUnresolvedConflicts(conflicts);
      return {
        ...req,
        conflicts,
        status: hasErrors ? RequirementStatus.PENDING : RequirementStatus.NORMAL
      };
    });

    set({
      requirements: updatedRequirements,
      versions: mockData.versions,
      filterSnapshots: mockData.filterSnapshots,
      exportHistory: mockData.exportHistory,
      globalChannels: mockData.globalChannels,
      globalMonitors: mockData.globalMonitors,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: updatedRequirements,
      versions: mockData.versions,
      filterSnapshots: mockData.filterSnapshots,
      exportHistory: mockData.exportHistory,
      globalChannels: mockData.globalChannels,
      globalMonitors: mockData.globalMonitors
    });
  },

  clearAllData: () => {
    set({
      ...getInitialState(),
      isLoaded: true,
      lastSaved: new Date().toISOString()
    });
    persistAllState({
      requirements: [],
      versions: [],
      filterSnapshots: [],
      exportHistory: [],
      globalChannels: [],
      globalMonitors: []
    });
  },

  addRequirement: (reqData) => {
    const now = new Date().toISOString();
    const newReq: BandRequirement = {
      ...reqData,
      id: generateId(),
      conflicts: [],
      status: RequirementStatus.NORMAL,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    const currentReqs = [...get().requirements, newReq];
    const conflicts = detectAllConflicts(newReq, currentReqs);
    const globalConflicts = detectGlobalChannelConflicts(currentReqs);
    const additionalConflicts = globalConflicts.get(newReq.id) || [];
    const allConflicts = [...conflicts, ...additionalConflicts];
    const hasErrors = hasUnresolvedConflicts(allConflicts);

    newReq.conflicts = allConflicts;
    newReq.status = hasErrors ? RequirementStatus.PENDING : RequirementStatus.NORMAL;

    const version = createVersion(newReq, '初始版本');

    const updatedReqs = currentReqs.map((r) => {
      if (r.id === newReq.id) return newReq;
      const extraConflicts = globalConflicts.get(r.id) || [];
      if (extraConflicts.length > 0) {
        return {
          ...r,
          conflicts: [...r.conflicts, ...extraConflicts],
          status: RequirementStatus.PENDING
        };
      }
      return r;
    });

    set({
      requirements: updatedReqs,
      versions: [...get().versions, version],
      lastSaved: now
    });

    persistAllState({
      requirements: updatedReqs,
      versions: [...get().versions, version],
      filterSnapshots: get().filterSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  updateRequirement: (id, updates, changeReason) => {
    const now = new Date().toISOString();
    const oldReq = get().requirements.find((r) => r.id === id);
    if (!oldReq) return;

    const newVersion = oldReq.currentVersion + 1;
    const updatedReq: BandRequirement = {
      ...oldReq,
      ...updates,
      currentVersion: newVersion,
      updatedAt: now
    };

    const otherReqs = get().requirements.filter((r) => r.id !== id);
    const allReqs = [...otherReqs, updatedReq];
    const conflicts = detectAllConflicts(updatedReq, allReqs);
    const globalConflicts = detectGlobalChannelConflicts(allReqs);
    const additionalConflicts = globalConflicts.get(updatedReq.id) || [];
    const allConflicts = [...conflicts, ...additionalConflicts];
    const hasErrors = hasUnresolvedConflicts(allConflicts);

    updatedReq.conflicts = allConflicts;
    updatedReq.status = hasErrors ? RequirementStatus.PENDING : RequirementStatus.NORMAL;

    const diff = compareVersions(oldReq, updatedReq);
    const summary = changeReason || generateChangeSummary(diff);
    const version = createVersion(updatedReq, summary);

    const updatedReqs = allReqs.map((r) => {
      if (r.id === updatedReq.id) return updatedReq;
      const extraConflicts = globalConflicts.get(r.id) || [];
      const existingUnresolved = r.conflicts.filter((c) => !c.resolved);
      if (extraConflicts.length > 0 || existingUnresolved.length > 0) {
        return {
          ...r,
          conflicts: [...r.conflicts.filter((c) => c.resolved), ...extraConflicts],
          status: RequirementStatus.PENDING
        };
      }
      return { ...r, status: RequirementStatus.NORMAL };
    });

    set({
      requirements: updatedReqs,
      versions: [...get().versions, version],
      lastSaved: now
    });

    persistAllState({
      requirements: updatedReqs,
      versions: [...get().versions, version],
      filterSnapshots: get().filterSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  deleteRequirement: (id) => {
    const remainingReqs = get().requirements.filter((r) => r.id !== id);
    const globalConflicts = detectGlobalChannelConflicts(remainingReqs);

    const updatedReqs = remainingReqs.map((r) => {
      const conflicts = detectAllConflicts(r, remainingReqs);
      const extraConflicts = globalConflicts.get(r.id) || [];
      const allConflicts = [...conflicts, ...extraConflicts];
      const hasErrors = hasUnresolvedConflicts(allConflicts);
      return {
        ...r,
        conflicts: allConflicts,
        status: hasErrors ? RequirementStatus.PENDING : RequirementStatus.NORMAL
      };
    });

    set({
      requirements: updatedReqs,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: updatedReqs,
      versions: get().versions,
      filterSnapshots: get().filterSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  getRequirementById: (id) => {
    return get().requirements.find((r) => r.id === id);
  },

  getFilteredRequirements: () => {
    const { requirements, currentFilters } = get();
    let filtered = [...requirements];

    if (currentFilters.bandName) {
      filtered = filtered.filter((r) =>
        r.bandName.toLowerCase().includes(currentFilters.bandName!.toLowerCase())
      );
    }

    if (currentFilters.status && currentFilters.status.length > 0) {
      filtered = filtered.filter((r) => currentFilters.status!.includes(r.status));
    }

    if (currentFilters.dateFrom) {
      filtered = filtered.filter((r) => r.performanceDate >= currentFilters.dateFrom!);
    }

    if (currentFilters.dateTo) {
      filtered = filtered.filter((r) => r.performanceDate <= currentFilters.dateTo!);
    }

    if (currentFilters.hasConflict !== undefined) {
      filtered = filtered.filter((r) => {
        const hasConflicts = r.conflicts.some((c) => !c.resolved);
        return currentFilters.hasConflict ? hasConflicts : !hasConflicts;
      });
    }

    return filtered;
  },

  runConflictDetection: () => {
    const { requirements } = get();
    const globalConflicts = detectGlobalChannelConflicts(requirements);

    const updatedReqs = requirements.map((req) => {
      const conflicts = detectAllConflicts(req, requirements);
      const extraConflicts = globalConflicts.get(req.id) || [];
      const allConflicts = [...conflicts, ...extraConflicts];
      const hasErrors = hasUnresolvedConflicts(allConflicts);
      return {
        ...req,
        conflicts: allConflicts,
        status: hasErrors ? RequirementStatus.PENDING : RequirementStatus.NORMAL
      };
    });

    set({
      requirements: updatedReqs,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: updatedReqs,
      versions: get().versions,
      filterSnapshots: get().filterSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  resolveConflict: (requirementId, conflictId) => {
    const { requirements } = get();
    const updatedReqs = requirements.map((req) => {
      if (req.id !== requirementId) return req;
      const updatedConflicts = req.conflicts.map((c) =>
        c.id === conflictId ? { ...c, resolved: true } : c
      );
      const hasErrors = hasUnresolvedConflicts(updatedConflicts);
      return {
        ...req,
        conflicts: updatedConflicts,
        status: hasErrors ? RequirementStatus.PENDING : RequirementStatus.NORMAL
      };
    });

    set({
      requirements: updatedReqs,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: updatedReqs,
      versions: get().versions,
      filterSnapshots: get().filterSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  setCurrentFilters: (filters) => {
    set({
      currentFilters: { ...get().currentFilters, ...filters }
    });
  },

  resetFilters: () => {
    set({ currentFilters: {} });
  },

  saveFilterSnapshot: (name) => {
    const snapshot: FilterSnapshot = {
      id: generateId(),
      name,
      filters: { ...get().currentFilters },
      createdAt: new Date().toISOString()
    };

    const updatedSnapshots = [...get().filterSnapshots, snapshot];
    set({
      filterSnapshots: updatedSnapshots,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: get().requirements,
      versions: get().versions,
      filterSnapshots: updatedSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  deleteFilterSnapshot: (id) => {
    const updatedSnapshots = get().filterSnapshots.filter((s) => s.id !== id);
    set({
      filterSnapshots: updatedSnapshots,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: get().requirements,
      versions: get().versions,
      filterSnapshots: updatedSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  applyFilterSnapshot: (id) => {
    const snapshot = get().filterSnapshots.find((s) => s.id === id);
    if (snapshot) {
      set({ currentFilters: { ...snapshot.filters } });
    }
  },

  addExportRecord: (record) => {
    const updatedHistory = [...get().exportHistory, record];
    set({
      exportHistory: updatedHistory,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: get().requirements,
      versions: get().versions,
      filterSnapshots: get().filterSnapshots,
      exportHistory: updatedHistory,
      globalChannels: get().globalChannels,
      globalMonitors: get().globalMonitors
    });
  },

  getVersionsForRequirement: (requirementId) => {
    return getVersionsForRequirement(get().versions, requirementId);
  },

  compareVersions: (v1, v2) => {
    return compareVersions(v1, v2);
  },

  setSelectedVersion: (version) => {
    set({ selectedVersion: version });
  },

  updateGlobalChannel: (channel) => {
    const existingIndex = get().globalChannels.findIndex((c) => c.id === channel.id);
    let updatedChannels: Channel[];
    if (existingIndex >= 0) {
      updatedChannels = get().globalChannels.map((c) =>
        c.id === channel.id ? channel : c
      );
    } else {
      updatedChannels = [...get().globalChannels, channel];
    }

    set({
      globalChannels: updatedChannels,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: get().requirements,
      versions: get().versions,
      filterSnapshots: get().filterSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: updatedChannels,
      globalMonitors: get().globalMonitors
    });
  },

  updateGlobalMonitor: (monitor) => {
    const existingIndex = get().globalMonitors.findIndex((m) => m.id === monitor.id);
    let updatedMonitors: Monitor[];
    if (existingIndex >= 0) {
      updatedMonitors = get().globalMonitors.map((m) =>
        m.id === monitor.id ? monitor : m
      );
    } else {
      updatedMonitors = [...get().globalMonitors, monitor];
    }

    set({
      globalMonitors: updatedMonitors,
      lastSaved: new Date().toISOString()
    });

    persistAllState({
      requirements: get().requirements,
      versions: get().versions,
      filterSnapshots: get().filterSnapshots,
      exportHistory: get().exportHistory,
      globalChannels: get().globalChannels,
      globalMonitors: updatedMonitors
    });
  }
}));
