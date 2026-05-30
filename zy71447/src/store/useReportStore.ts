import { create } from 'zustand';
import type {
  ReportBatch,
  InstrumentModel,
  SectionParams,
  BandType,
  RiskItem,
} from '@/types';
import { ReportGenerator } from '@/utils/reportGenerator';

interface ReportState {
  batches: ReportBatch[];
  currentBatch: ReportBatch | null;
  batchSequence: number;
  reviewer: string;
  isGenerating: boolean;
  selectedBatchIds: string[];

  createBatch: (
    instrument: InstrumentModel,
    risks: RiskItem[],
    sectionParams: SectionParams,
    currentBand: BandType
  ) => ReportBatch;
  setReviewer: (name: string) => void;
  selectBatch: (id: string | null) => void;
  toggleBatchSelection: (id: string) => void;
  clearSelection: () => void;
  deleteBatch: (id: string) => void;
  exportBatch: (batch: ReportBatch, elementId?: string) => Promise<void>;
  exportSelectedBatches: (elementId?: string) => Promise<void>;
  getBatchById: (id: string) => ReportBatch | undefined;
}

export const useReportStore = create<ReportState>((set, get) => ({
  batches: [],
  currentBatch: null,
  batchSequence: 1,
  reviewer: '',
  isGenerating: false,
  selectedBatchIds: [],

  createBatch: (instrument, risks, sectionParams, currentBand) => {
    const { batchSequence, reviewer } = get();
    const batch = ReportGenerator.createReportBatch(
      instrument,
      risks,
      sectionParams,
      currentBand,
      batchSequence,
      reviewer || undefined
    );

    set((state) => ({
      batches: [batch, ...state.batches],
      currentBatch: batch,
      batchSequence: state.batchSequence + 1,
    }));

    return batch;
  },

  setReviewer: (name) => {
    set({ reviewer: name });
  },

  selectBatch: (id) => {
    if (id === null) {
      set({ currentBatch: null });
      return;
    }
    const batch = get().batches.find((b) => b.id === id);
    set({ currentBatch: batch || null });
  },

  toggleBatchSelection: (id) => {
    set((state) => ({
      selectedBatchIds: state.selectedBatchIds.includes(id)
        ? state.selectedBatchIds.filter((b) => b !== id)
        : [...state.selectedBatchIds, id],
    }));
  },

  clearSelection: () => {
    set({ selectedBatchIds: [] });
  },

  deleteBatch: (id) => {
    set((state) => ({
      batches: state.batches.filter((b) => b.id !== id),
      currentBatch: state.currentBatch?.id === id ? null : state.currentBatch,
      selectedBatchIds: state.selectedBatchIds.filter((b) => b !== id),
    }));
  },

  exportBatch: async (batch, elementId) => {
    set({ isGenerating: true });
    try {
      await ReportGenerator.generateAndDownload(batch, elementId);
    } finally {
      set({ isGenerating: false });
    }
  },

  exportSelectedBatches: async (elementId) => {
    const { selectedBatchIds, batches } = get();
    const selectedBatches = batches.filter((b) => selectedBatchIds.includes(b.id));

    set({ isGenerating: true });
    try {
      for (const batch of selectedBatches) {
        await ReportGenerator.generateAndDownload(batch, elementId);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      set({ isGenerating: false });
    }
  },

  getBatchById: (id) => {
    return get().batches.find((b) => b.id === id);
  },
}));
