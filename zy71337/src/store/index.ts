import { create } from 'zustand';
import {
  Work,
  Note,
  RetrievalResult,
  RetrievalParams,
  MelodySegment,
  RetrievalRecord,
} from '@/types';
import { createMelodySegment, retrieveSimilarMelodies } from '@/utils/melodyEngine';
import { sampleWorks } from '@/data/sampleData';

interface AppState {
  works: Work[];
  queryNotes: Note[];
  querySegment: MelodySegment | null;
  results: RetrievalResult[];
  selectedResult: RetrievalResult | null;
  params: RetrievalParams;
  isRetrieving: boolean;
  records: RetrievalRecord[];
  expandedRowId: string | null;
  setQueryNotes: (notes: Note[]) => void;
  setParams: (params: Partial<RetrievalParams>) => void;
  performRetrieval: () => void;
  selectResult: (result: RetrievalResult | null) => void;
  setExpandedRowId: (id: string | null) => void;
  addWork: (work: Work) => void;
  removeWork: (id: string) => void;
  clearResults: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  works: sampleWorks,
  queryNotes: [],
  querySegment: null,
  results: [],
  selectedResult: null,
  params: {
    contourWeight: 0.6,
    rhythmWeight: 0.4,
    transpositionTolerance: 12,
    stretchThreshold: 0.4,
    minMatchScore: 0.6,
    maxResults: 20,
  },
  isRetrieving: false,
  records: [],
  expandedRowId: null,

  setQueryNotes: (notes: Note[]) => {
    set({ queryNotes: notes });
  },

  setParams: (params: Partial<RetrievalParams>) => {
    set((state) => ({ params: { ...state.params, ...params } }));
  },

  performRetrieval: () => {
    const { queryNotes, works, params } = get();
    if (queryNotes.length === 0) return;

    set({ isRetrieving: true });

    const querySegment = createMelodySegment(queryNotes, 'query');

    setTimeout(() => {
      const results = retrieveSimilarMelodies(querySegment, works, params);

      const record: RetrievalRecord = {
        id: `rec_${Date.now()}`,
        queryTitle: `检索_${new Date().toLocaleString()}`,
        resultsCount: results.length,
        highSimilarityCount: results.filter((r) => r.scores.overall >= 0.8).length,
        parameters: { ...params },
        createdAt: new Date(),
      };

      set({
        querySegment,
        results,
        isRetrieving: false,
        records: [record, ...get().records],
      });
    }, 500);
  },

  selectResult: (result: RetrievalResult | null) => {
    set({ selectedResult: result });
  },

  setExpandedRowId: (id: string | null) => {
    set({ expandedRowId: id });
  },

  addWork: (work: Work) => {
    set((state) => ({ works: [...state.works, work] }));
  },

  removeWork: (id: string) => {
    set((state) => ({ works: state.works.filter((w) => w.id !== id) }));
  },

  clearResults: () => {
    set({ results: [], selectedResult: null });
  },
}));
