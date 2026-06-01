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

function buildDerivedState(samples: HistoricalSample[], configs: ParamConfig[]) {
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

  setFilter: (f: Partial<FilterState>) => void;
  submitReview: (sampleId: string, action: ReviewAction, note: string, operator: string) => void;
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
}));
