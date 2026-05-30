import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Version, Simulation, ImportCheckResult } from '@/types/simulation';
import { checkImportData, createVersion, compareVersions } from '@/utils/version/control';

interface HistoryState {
  versions: Version[];
  currentVersionId: string | null;
  importCheckResult: ImportCheckResult | null;
  createNewVersion: (simulation: Simulation, changeSummary: string, createdBy: string) => Version;
  revertToVersion: (versionId: string) => Simulation | null;
  getVersionDiff: (versionId1: string, versionId2: string) => { added: string[]; removed: string[]; modified: string[] };
  checkImport: (existingData: Simulation, importData: Simulation) => ImportCheckResult;
  clearImportCheck: () => void;
  loadVersions: (versions: Version[]) => void;
}

export const useHistoryStore = create<HistoryState>()(
  immer((set, get) => ({
    versions: [],
    currentVersionId: null,
    importCheckResult: null,

    createNewVersion: (simulation, changeSummary, createdBy) => {
      const parentVersion = get().versions.length > 0
        ? get().versions[get().versions.length - 1]
        : null;
      const newVersion = createVersion(simulation, parentVersion, changeSummary, createdBy);
      set((state) => {
        state.versions.push(newVersion);
        state.currentVersionId = newVersion.id;
      });
      return newVersion;
    },

    revertToVersion: (versionId) => {
      const version = get().versions.find(v => v.id === versionId);
      if (!version) return null;
      try {
        return JSON.parse(version.diffData) as Simulation;
      } catch {
        return null;
      }
    },

    getVersionDiff: (versionId1, versionId2) => {
      const v1 = get().versions.find(v => v.id === versionId1);
      const v2 = get().versions.find(v => v.id === versionId2);
      if (!v1 || !v2) return { added: [], removed: [], modified: [] };
      return compareVersions(v1, v2);
    },

    checkImport: (existingData, importData) => {
      const result = checkImportData(existingData, importData);
      set({ importCheckResult: result });
      return result;
    },

    clearImportCheck: () => set({ importCheckResult: null }),

    loadVersions: (versions) => set({
      versions,
      currentVersionId: versions.length > 0 ? versions[versions.length - 1].id : null,
    }),
  }))
);
