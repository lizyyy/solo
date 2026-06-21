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
} from '@/data/demoData';
import { reviewBoundary } from '@/engine/boundaryReviewEngine';

function buildInitialResults(problems: Problem[], paramsA: ReviewParams, paramsB: ReviewParams) {
  return {
    reviewResultsA: problems.map((p) => reviewBoundary(p, paramsA)),
    reviewResultsB: problems.map((p) => reviewBoundary(p, paramsB)),
  };
}

function resolveStatus(problem: Problem, result?: ReviewResult) {
  if (result?.status === 'unit_issue') return 'unit_issue';
  if (result?.status === 'abnormal') return 'abnormal';
  if (result?.status === 'normal') return 'normal';
  if (result?.status === 'skipped') return 'pending';
  return problem.reviewStatus;
}

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
  getActiveResults: () => ReviewResult[];
  getFilteredProblems: () => Problem[];
  getFilteredResults: () => ReviewResult[];
  getReviewResult: (problemId: string, group: 'A' | 'B') => ReviewResult | undefined;
  getStatistics: () => {
    total: number;
    normal: number;
    abnormal: number;
    unitIssue: number;
    pending: number;
  };
  resolveProblemStatus: (problem: Problem) => 'pending' | 'normal' | 'abnormal' | 'unit_issue';
}

const initialParamsA = { ...defaultReviewParamsA };
const initialParamsB = { ...defaultReviewParamsB };
const initialResults = buildInitialResults(demoProblems, initialParamsA, initialParamsB);

export const useAppStore = create<AppState>((set, get) => ({
  problems: demoProblems,
  reviewParamsA: initialParamsA,
  reviewParamsB: initialParamsB,
  activeParamsGroup: 'A',
  reviewResultsA: initialResults.reviewResultsA,
  reviewResultsB: initialResults.reviewResultsB,
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
    'P-003': '灰度发布v2.1：本次复核将边界判定从「通过」改为「异常」，原因是容差标准收紧至2%',
  },

  setFilterCriteria: (criteria) =>
    set((state) => ({
      filterCriteria: { ...state.filterCriteria, ...criteria },
    })),

  setActiveParamsGroup: (group) => set({ activeParamsGroup: group }),

  updateReviewParams: (group, partial) => {
    const paramsKey = `reviewParams${group}` as const;
    const resultsKey = `reviewResults${group}` as const;

    const newParams = { ...get()[paramsKey], ...partial };
    const { problems } = get();
    const newResults = problems.map((p) => reviewBoundary(p, { ...newParams, groupId: group }));

    set({
      [paramsKey]: newParams,
      [resultsKey]: newResults,
    } as unknown as Partial<AppState>);
  },

  runReview: (problemId, group) => {
    const problem = get().problems.find((p) => p.id === problemId);
    if (!problem) return;
    const params = group === 'A' ? get().reviewParamsA : get().reviewParamsB;
    const result = reviewBoundary(problem, { ...params, groupId: group });
    const resultsKey = `reviewResults${group}` as const;

    set((state) => {
      const results = [...state[resultsKey]];
      const idx = results.findIndex((r) => r.problemId === problemId);
      if (idx >= 0) results[idx] = result;
      else results.push(result);
      return { [resultsKey]: results };
    });
  },

  runAllReviews: (group) => {
    const { problems } = get();
    const params = group === 'A' ? get().reviewParamsA : get().reviewParamsB;
    const results = problems.map((p) => reviewBoundary(p, { ...params, groupId: group }));
    const key = `reviewResults${group}` as const;
    set({ [key]: results });
  },

  selectProblem: (id) => set({ selectedProblemId: id }),

  highlightRow: (id) => set({ highlightedRowId: id }),

  setGrayReleaseNote: (problemId, note) =>
    set((state) => ({
      grayReleaseNotes: { ...state.grayReleaseNotes, [problemId]: note },
    })),

  getActiveResults: () => {
    return get().activeParamsGroup === 'A' ? get().reviewResultsA : get().reviewResultsB;
  },

  resolveProblemStatus: (problem) => {
    const activeResults = get().getActiveResults();
    const result = activeResults.find((r) => r.problemId === problem.id);
    return resolveStatus(problem, result);
  },

  getFilteredProblems: () => {
    const { problems, filterCriteria } = get();
    const { difficulties, constraintTypes, reviewStatuses, showUnitIssuesOnly, keyword } = filterCriteria;

    return problems.filter((p) => {
      const resolvedStatus = get().resolveProblemStatus(p);

      if (difficulties.length > 0 && !difficulties.includes(p.difficulty)) return false;
      if (constraintTypes.length > 0 && !constraintTypes.includes(p.constraintType)) return false;
      if (reviewStatuses.length > 0 && !reviewStatuses.includes(resolvedStatus)) return false;
      if (showUnitIssuesOnly && !p.hasUnitIssue) return false;
      if (keyword && !p.title.includes(keyword) && !p.knowledgePoint.includes(keyword)) return false;
      return true;
    });
  },

  getFilteredResults: () => {
    const filtered = get().getFilteredProblems();
    const activeResults = get().getActiveResults();
    return filtered
      .map((p) => activeResults.find((r) => r.problemId === p.id))
      .filter((r): r is ReviewResult => !!r);
  },

  getReviewResult: (problemId, group) => {
    const results = group === 'A' ? get().reviewResultsA : get().reviewResultsB;
    return results.find((r) => r.problemId === problemId);
  },

  getStatistics: () => {
    const problems = get().getFilteredProblems();

    let normal = 0;
    let abnormal = 0;
    let unitIssue = 0;
    let pending = 0;

    problems.forEach((p) => {
      const s = get().resolveProblemStatus(p);
      switch (s) {
        case 'normal': normal++; break;
        case 'abnormal': abnormal++; break;
        case 'unit_issue': unitIssue++; break;
        case 'pending': pending++; break;
      }
    });

    return { total: problems.length, normal, abnormal, unitIssue, pending };
  },
}));
