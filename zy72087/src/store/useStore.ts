import { create } from 'zustand';
import type {
  HistoricalSample,
  ParamConfig,
  QualityIssue,
  ReasoningChain,
  ManualReview,
  FilterState,
  ReviewAction,
} from '@/types';
import { paramConfigs, historicalSamples } from '@/data/mockData';
import { validateData } from '@/engine/validator';
import { generateReasoningChains } from '@/engine/optimizer';

export function buildDerivedState(samples: HistoricalSample[], configs: ParamConfig[]) {
  const issues = validateData(samples, configs);

  const nullSampleIds = new Set<string>();
  const overBoundsSampleIds = new Set<string>();
  const boundarySampleIds = new Set<string>();

  for (const issue of issues) {
    if (issue.type === 'null_value') {
      for (const id of issue.sampleIds) nullSampleIds.add(id);
    }
    if (issue.type === 'out_of_bounds' && issue.severity === 'error') {
      for (const id of issue.sampleIds) overBoundsSampleIds.add(id);
    }
    if (issue.type === 'out_of_bounds' && issue.severity === 'info') {
      for (const id of issue.sampleIds) boundarySampleIds.add(id);
    }
  }

  const chains = generateReasoningChains(samples, configs, nullSampleIds, overBoundsSampleIds, boundarySampleIds);
  return { issues, chains };
}

const initial = buildDerivedState(historicalSamples, paramConfigs);

interface AppState {
  samples: HistoricalSample[];
  configs: ParamConfig[];
  issues: QualityIssue[];
  chains: ReasoningChain[];
  reviews: ManualReview[];
  filter: FilterState;
  caliberLabel: string;
  importHistory: { fileName: string; count: number; timestamp: string }[];

  setFilter: (f: Partial<FilterState>) => void;
  submitReview: (sampleId: string, action: ReviewAction, note: string, operator: string) => void;
  importSamples: (newSamples: HistoricalSample[], fileName: string) => void;
  resetSamples: () => void;
}

export const useStore = create<AppState>((set) => ({
  samples: historicalSamples,
  configs: paramConfigs,
  issues: initial.issues,
  chains: initial.chains,
  reviews: [],
  filter: {
    lineId: '',
    timePeriod: '',
    dateRange: ['', ''],
    source: '',
    issueType: '',
  },
  caliberLabel: '全部数据',
  importHistory: [],

  setFilter: (f) => {
    set((state) => {
      const newFilter = { ...state.filter, ...f };
      const parts: string[] = [];
      if (newFilter.lineId) {
        const line = state.samples.find((s) => s.lineId === newFilter.lineId);
        if (line) parts.push(line.lineName);
      }
      if (newFilter.timePeriod) parts.push(newFilter.timePeriod);
      if (newFilter.source) parts.push(newFilter.source);
      if (newFilter.issueType) parts.push(newFilter.issueType);
      const caliberLabel = parts.length > 0 ? parts.join(' · ') : '全部数据';
      return { filter: newFilter, caliberLabel };
    });
  },

  submitReview: (sampleId, action, note, operator) => {
    set((state) => ({
      reviews: [
        ...state.reviews.filter((r) => r.sampleId !== sampleId),
        {
          id: `MR_${sampleId}`,
          sampleId,
          action,
          note,
          operator,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  importSamples: (newSamples, fileName) => {
    set((state) => {
      const combined = [...state.samples, ...newSamples];
      const derived = buildDerivedState(combined, state.configs);
      return {
        samples: combined,
        issues: derived.issues,
        chains: derived.chains,
        importHistory: [
          { fileName, count: newSamples.length, timestamp: new Date().toISOString() },
          ...state.importHistory,
        ],
      };
    });
  },

  resetSamples: () => {
    const derived = buildDerivedState(historicalSamples, paramConfigs);
    set({
      samples: historicalSamples,
      issues: derived.issues,
      chains: derived.chains,
      importHistory: [],
      filter: {
        lineId: '',
        timePeriod: '',
        dateRange: ['', ''],
        source: '',
        issueType: '',
      },
      caliberLabel: '全部数据',
    });
  },
}));
