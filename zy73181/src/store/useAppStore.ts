import { create } from 'zustand';
import type {
  Problem,
  ReviewParams,
  ReviewResult,
  FilterCriteria,
} from '@/types';
import {
  demoProblems,
  defaultReviewParamsA,
  defaultReviewParamsB,
  demoReviewResultsA,
  demoReviewResultsB,
} from '@/data/demoData';
import { reviewBoundary } from '@/engine/boundaryReviewEngine';

interface AppState {
  problems: Problem[];
  reviewParamsA: ReviewParams;
  reviewParamsB: ReviewParams;
  activeParamsGroup: 'A' | 'B';
  reviewResultsA: ReviewResult[];
  reviewResultsB: ReviewResult[];
  filterCriteria: FilterCriteria;
  selectedProblemId: string | null;
  highlightedRowId: string | null;
  grayReleaseNotes: Record<string, string>;

  setFilterCriteria: (criteria: Partial<FilterCriteria>) => void;
  setActiveParamsGroup: (group: 'A' | 'B') => void;
  updateReviewParams: (group: 'A' | 'B', params: Partial<ReviewParams>) => void;
  runReview: (problemId: string, group: 'A' | 'B') => void;
  runAllReviews: (group: 'A' | 'B') => void;
  selectProblem: (id: string | null) => void;
  highlightRow: (id: string | null) => void;
  setGrayReleaseNote: (problemId: string, note: string) => void;
  getFilteredProblems: () => Problem[];
  getReviewResult: (problemId: string, group: 'A' | 'B') => ReviewResult | undefined;
  getStatistics: () => {
    total: number;
    normal: number;
    abnormal: number;
    unitIssue: number;
    pending: number;
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  problems: demoProblems,
  reviewParamsA: defaultReviewParamsA,
  reviewParamsB: defaultReviewParamsB,
  activeParamsGroup: 'A',
  reviewResultsA: demoReviewResultsA,
  reviewResultsB: demoReviewResultsB,
  filterCriteria: {
    difficulties: [],
    constraintTypes: [],
    reviewStatuses: [],
    showUnitIssuesOnly: false,
    keyword: '',
  },
  selectedProblemId: null,
  highlightedRowId: null,
  grayReleaseNotes: {
    'P-003': '灰度发布v2.1：本次复核将边界判定从"通过"改为"异常"，原因是容差标准收紧至2%',
  },

  setFilterCriteria: (criteria) =>
    set((state) => ({
      filterCriteria: { ...state.filterCriteria, ...criteria },
    })),

  setActiveParamsGroup: (group) => set({ activeParamsGroup: group }),

  updateReviewParams: (group, params) =>
    set((state) => ({
      [`reviewParams${group}`]: {
        ...state[`reviewParams${group}`],
        ...params,
      },
    })),

  runReview: (problemId, group) => {
    const problem = get().problems.find((p) => p.id === problemId);
    if (!problem) return;

    const params = group === 'A' ? get().reviewParamsA : get().reviewParamsB;
    const result = reviewBoundary(problem, params);

    set((state) => {
      const resultsKey = `reviewResults${group}` as const;
      const results = [...state[resultsKey]];
      const idx = results.findIndex((r) => r.problemId === problemId);
      if (idx >= 0) {
        results[idx] = result;
      } else {
        results.push(result);
      }
      return { [resultsKey]: results };
    });
  },

  runAllReviews: (group) => {
    const { problems, reviewParamsA, reviewParamsB } = get();
    const params = group === 'A' ? reviewParamsA : reviewParamsB;

    const results = problems.map((p) => reviewBoundary(p, params));
    const key = `reviewResults${group}` as const;
    set({ [key]: results });
  },

  selectProblem: (id) => set({ selectedProblemId: id }),

  highlightRow: (id) => set({ highlightedRowId: id }),

  setGrayReleaseNote: (problemId, note) =>
    set((state) => ({
      grayReleaseNotes: { ...state.grayReleaseNotes, [problemId]: note },
    })),

  getFilteredProblems: () => {
    const { problems, filterCriteria } = get();
    const { difficulties, constraintTypes, reviewStatuses, showUnitIssuesOnly, keyword } = filterCriteria;

    return problems.filter((p) => {
      if (difficulties.length > 0 && !difficulties.includes(p.difficulty)) return false;
      if (constraintTypes.length > 0 && !constraintTypes.includes(p.constraintType)) return false;
      if (reviewStatuses.length > 0 && !reviewStatuses.includes(p.reviewStatus)) return false;
      if (showUnitIssuesOnly && !p.hasUnitIssue) return false;
      if (keyword && !p.title.includes(keyword) && !p.knowledgePoint.includes(keyword)) return false;
      return true;
    });
  },

  getReviewResult: (problemId, group) => {
    const results = group === 'A' ? get().reviewResultsA : get().reviewResultsB;
    return results.find((r) => r.problemId === problemId);
  },

  getStatistics: () => {
    const problems = get().getFilteredProblems();
    return {
      total: problems.length,
      normal: problems.filter((p) => p.reviewStatus === 'normal').length,
      abnormal: problems.filter((p) => p.reviewStatus === 'abnormal').length,
      unitIssue: problems.filter((p) => p.reviewStatus === 'unit_issue' || p.hasUnitIssue).length,
      pending: problems.filter((p) => p.reviewStatus === 'pending').length,
    };
  },
}));
