import { create } from 'zustand';
import { ScreeningVersion, Remittance, VersionCompareResult } from '../types';
import { screeningVersions, getLatestVersion, getVersionById } from '../data/mockData';
import { compareVersions } from '../utils/compare';

interface ScreeningState {
  versions: ScreeningVersion[];
  currentVersionId: string;
  searchKeyword: string;
  compareVersionIdA: string | null;
  compareVersionIdB: string | null;
  compareResult: VersionCompareResult | null;

  setCurrentVersion: (versionId: string) => void;
  setSearchKeyword: (keyword: string) => void;
  setCompareVersionA: (versionId: string | null) => void;
  setCompareVersionB: (versionId: string | null) => void;
  performCompare: () => void;
  getCurrentVersion: () => ScreeningVersion;
  getRemittanceById: (remittanceId: string) => Remittance | undefined;
  getFilteredRemittances: () => Remittance[];
}

export const useScreeningStore = create<ScreeningState>((set, get) => ({
  versions: screeningVersions,
  currentVersionId: getLatestVersion().id,
  searchKeyword: '',
  compareVersionIdA: null,
  compareVersionIdB: null,
  compareResult: null,

  setCurrentVersion: (versionId: string) => {
    set({ currentVersionId: versionId });
  },

  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword });
  },

  setCompareVersionA: (versionId: string | null) => {
    set({ compareVersionIdA: versionId, compareResult: null });
  },

  setCompareVersionB: (versionId: string | null) => {
    set({ compareVersionIdB: versionId, compareResult: null });
  },

  performCompare: () => {
    const { compareVersionIdA, compareVersionIdB, versions } = get();
    if (!compareVersionIdA || !compareVersionIdB) return;

    const versionA = versions.find(v => v.id === compareVersionIdA);
    const versionB = versions.find(v => v.id === compareVersionIdB);
    if (!versionA || !versionB) return;

    const result = compareVersions(versionA, versionB);
    set({ compareResult: result });
  },

  getCurrentVersion: () => {
    const { currentVersionId, versions } = get();
    return getVersionById(currentVersionId) || versions[0];
  },

  getRemittanceById: (remittanceId: string) => {
    const version = get().getCurrentVersion();
    return version.remittances.find(r => r.id === remittanceId);
  },

  getFilteredRemittances: () => {
    const version = get().getCurrentVersion();
    const keyword = get().searchKeyword.toLowerCase().trim();
    if (!keyword) return version.remittances;

    return version.remittances.filter(r =>
      r.transactionId.toLowerCase().includes(keyword) ||
      r.payer.toLowerCase().includes(keyword) ||
      r.payee.toLowerCase().includes(keyword)
    );
  }
}));
