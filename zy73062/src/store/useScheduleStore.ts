import { create } from 'zustand';
import type { ScheduleVersion, ChangeHistoryItem, EvidenceItem, MaterialLocation, ScheduleStatus, ScheduleAggregate } from '../types/schedule';
import { defaultVersions, defaultHistories, defaultEvidences } from '../data/schedules';
import { defaultLocations } from '../data/locations';
import { trialVersions, trialHistories, trialEvidences, trialWithdrawnEmbedVersion } from '../data/trialDataset';
import { dedupAndAggregate } from '../utils/dedup';

interface ScheduleState {
  versions: ScheduleVersion[];
  histories: ChangeHistoryItem[];
  evidences: EvidenceItem[];
  locations: MaterialLocation[];
  selectedBizKey: string | null;
  filterStatus: 'all' | ScheduleStatus;
  searchKeyword: string;
  trialMode: boolean;
  trialVersions: ScheduleVersion[];
  trialHistories: ChangeHistoryItem[];
  trialEvidences: EvidenceItem[];
  trialWithdrawnEmbedVersion: ScheduleVersion;

  aggregates: () => ScheduleAggregate[];
  filteredAggregates: () => ScheduleAggregate[];
  trialAggregates: () => ScheduleAggregate[];
  cleanTrialAggregates: () => ScheduleAggregate[];

  setFilterStatus: (s: 'all' | ScheduleStatus) => void;
  setSearchKeyword: (k: string) => void;
  setSelectedBizKey: (k: string | null) => void;
  submitDuplicate: (bizKey: string) => void;
  toggleTrialMode: () => void;
  resetTrialData: () => void;
}

function generateId(): string {
  return `SCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  versions: defaultVersions,
  histories: defaultHistories,
  evidences: defaultEvidences,
  locations: defaultLocations,
  selectedBizKey: null,
  filterStatus: 'all',
  searchKeyword: '',
  trialMode: true,
  trialVersions: trialVersions,
  trialHistories: trialHistories,
  trialEvidences: trialEvidences,
  trialWithdrawnEmbedVersion: trialWithdrawnEmbedVersion,

  aggregates: () => {
    const state = get();
    return dedupAndAggregate(state.versions, state.histories, state.evidences);
  },

  filteredAggregates: () => {
    const state = get();
    const aggs = state.aggregates();
    const kw = state.searchKeyword.trim().toLowerCase();

    let result = aggs;
    if (state.filterStatus !== 'all') {
      result = result.filter(a => a.latest.status === state.filterStatus);
    }
    if (kw) {
      result = result.filter(a =>
        a.latest.pipelineNo.toLowerCase().includes(kw) ||
        a.latest.partName.toLowerCase().includes(kw) ||
        a.latest.partModel.toLowerCase().includes(kw)
      );
    }
    return result;
  },

  trialAggregates: () => {
    const state = get();
    return dedupAndAggregate(state.trialVersions, state.trialHistories, state.trialEvidences);
  },

  cleanTrialAggregates: () => {
    const state = get();
    const aggs = dedupAndAggregate(state.trialVersions, state.trialHistories, state.trialEvidences);
    return aggs.filter(a => a.latest.status !== 'withdrawn');
  },

  setFilterStatus: (s) => set({ filterStatus: s }),
  setSearchKeyword: (k) => set({ searchKeyword: k }),
  setSelectedBizKey: (k) => set({ selectedBizKey: k }),

  submitDuplicate: (bizKey) => set((state) => {
    const isTrial = state.trialMode;
    const srcVersions = isTrial ? state.trialVersions : state.versions;
    const srcHistories = isTrial ? state.trialHistories : state.histories;
    const aggs = dedupAndAggregate(srcVersions, srcHistories, isTrial ? state.trialEvidences : state.evidences);
    const agg = aggs.find(a => a.bizKey === bizKey);
    if (!agg) return {};

    const latest = agg.latest;
    const newVersion: ScheduleVersion = {
      ...latest,
      id: generateId(),
      version: latest.version + 1,
      status: 'pending',
      submittedAt: formatNow(),
      submitter: '巡检员-模拟',
    };

    const historyItem: ChangeHistoryItem = {
      id: `HIST-${Date.now()}`,
      scheduleId: newVersion.id,
      changeType: 'resubmit',
      timestamp: formatNow(),
      operator: '系统-模拟',
      newMaterial: `${latest.partName} ${latest.partModel}`,
      newRemark: latest.manualRemark,
    };

    if (isTrial) {
      return {
        trialVersions: [...state.trialVersions, newVersion],
        trialHistories: [...state.trialHistories, historyItem],
      };
    } else {
      return {
        versions: [...state.versions, newVersion],
        histories: [...state.histories, historyItem],
      };
    }
  }),

  toggleTrialMode: () => set((state) => ({
    trialMode: !state.trialMode,
    selectedBizKey: null,
  })),

  resetTrialData: () => set({
    trialVersions: trialVersions,
    trialHistories: trialHistories,
    trialEvidences: trialEvidences,
    filterStatus: 'all',
    searchKeyword: '',
    selectedBizKey: null,
  }),
}));
