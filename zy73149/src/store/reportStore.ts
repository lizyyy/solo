import { create } from 'zustand';
import type {
  ReportVersion,
  SedimentRecord,
  FilterState,
  ReportParams,
  ExportOptions,
} from '@/types';
import {
  mockVersions,
  getRecordsByVersion,
  getVersionById,
} from '@/data/mockData';

interface ReportState {
  versions: ReportVersion[];
  currentVersionId: string;
  records: SedimentRecord[];
  filter: FilterState;
  versionSidebarOpen: boolean;
  exportModalOpen: boolean;
  selectedRecordId: string | null;
  compareVersionIds: [string, string];

  setCurrentVersion: (versionId: string) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  toggleVersionSidebar: () => void;
  toggleExportModal: () => void;
  setSelectedRecordId: (id: string | null) => void;
  setCompareVersionIds: (ids: [string, string]) => void;

  getCurrentVersion: () => ReportVersion | undefined;
  getFilteredRecords: () => SedimentRecord[];
  getCurrentParams: () => ReportParams | undefined;

  getStats: () => {
    total: number;
    normal: number;
    anomaly: number;
    cloudCover: number;
    severeRate: number;
  };
}

const initialFilter: FilterState = {
  dateRange: null,
  dataSources: ['buoy', 'remoteSensing'],
  anomalyTypes: ['none', 'cloudCover', 'missingData', 'outOfRange'],
  sedimentLevels: ['normal', 'mild', 'moderate', 'severe'],
  keyword: '',
};

export const useReportStore = create<ReportState>((set, get) => ({
  versions: mockVersions,
  currentVersionId: 'v3',
  records: getRecordsByVersion('v3'),
  filter: initialFilter,
  versionSidebarOpen: true,
  exportModalOpen: false,
  selectedRecordId: null,
  compareVersionIds: ['v2', 'v3'],

  setCurrentVersion: (versionId: string) => {
    set({
      currentVersionId: versionId,
      records: getRecordsByVersion(versionId),
    });
  },

  setFilter: (filter: Partial<FilterState>) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  resetFilter: () => {
    set({ filter: initialFilter });
  },

  toggleVersionSidebar: () => {
    set((state) => ({ versionSidebarOpen: !state.versionSidebarOpen }));
  },

  toggleExportModal: () => {
    set((state) => ({ exportModalOpen: !state.exportModalOpen }));
  },

  setSelectedRecordId: (id: string | null) => {
    set({ selectedRecordId: id });
  },

  setCompareVersionIds: (ids: [string, string]) => {
    set({ compareVersionIds: ids });
  },

  getCurrentVersion: () => {
    return get().versions.find((v) => v.id === get().currentVersionId);
  },

  getFilteredRecords: () => {
    const { records, filter } = get();

    return records.filter((r) => {
      if (
        filter.dataSources.length > 0 &&
        !filter.dataSources.includes(r.source)
      ) {
        return false;
      }

      if (
        filter.anomalyTypes.length > 0 &&
        !filter.anomalyTypes.includes(r.anomalyType)
      ) {
        return false;
      }

      if (
        filter.sedimentLevels.length > 0 &&
        !filter.sedimentLevels.includes(r.sedimentLevel)
      ) {
        return false;
      }

      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase();
        return (
          r.id.toLowerCase().includes(kw) ||
          r.remark?.toLowerCase().includes(kw) ||
          r.rawLatitude.toLowerCase().includes(kw) ||
          r.rawLongitude.toLowerCase().includes(kw)
        );
      }

      return true;
    });
  },

  getCurrentParams: () => {
    return get().getCurrentVersion()?.params;
  },

  getStats: () => {
    const records = get().getFilteredRecords();
    const total = records.length;
    const normal = records.filter((r) => r.isNormal).length;
    const anomaly = records.filter((r) => !r.isNormal).length;
    const cloudCover = records.filter((r) => r.anomalyType === 'cloudCover').length;
    const severe = records.filter((r) => r.sedimentLevel === 'severe').length;
    const severeRate = total > 0 ? (severe / total) * 100 : 0;

    return { total, normal, anomaly, cloudCover, severeRate };
  },
}));

export type { ExportOptions };
