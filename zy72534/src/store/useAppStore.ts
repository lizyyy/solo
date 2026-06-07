import { create } from 'zustand';
import { Batch, Sample, Comment, Review, CommentAuthor, NextOwner } from '../types';
import { mockBatches, mockSamples } from '../data/mockData';
import { generateId } from '../utils/formatters';
import { detectAnomalies } from '../utils/anomalyDetector';

interface AppState {
  batches: Batch[];
  samples: Sample[];
  selectedBatchId: string | null;
  setSelectedBatchId: (id: string | null) => void;
  addBatch: (batch: Omit<Batch, 'id' | 'anomalyCount'>) => void;
  addSamples: (samples: Omit<Sample, 'id' | 'isAnomaly' | 'versions' | 'comments'>[]) => void;
  addComment: (sampleId: string, author: CommentAuthor, content: string) => void;
  updateSampleStatus: (sampleId: string, status: Sample['status']) => void;
  updateReview: (sampleId: string, review: Partial<Review>) => void;
  getSampleById: (id: string) => Sample | undefined;
  getSamplesByBatch: (batchId: string) => Sample[];
  getAnomalySamples: () => Sample[];
}

export const useAppStore = create<AppState>((set, get) => ({
  batches: mockBatches,
  samples: mockSamples,
  selectedBatchId: 'batch-001',

  setSelectedBatchId: (id) => set({ selectedBatchId: id }),

  addBatch: (batch) => {
    const newBatch: Batch = {
      ...batch,
      id: `batch-${generateId()}`,
      anomalyCount: 0,
    };
    set((state) => ({
      batches: [...state.batches, newBatch],
      selectedBatchId: newBatch.id,
    }));
  },

  addSamples: (newSamples) => {
    const { selectedBatchId } = get();
    if (!selectedBatchId) return;

    const samplesWithIds: Sample[] = newSamples.map((s) => ({
      ...s,
      id: `sample-${generateId()}`,
      isAnomaly: false,
      versions: [
        {
          id: `v-${generateId()}`,
          modelVersion: s.currentModelVersion,
          tags: {},
          timestamp: new Date().toISOString(),
        },
      ],
      comments: [],
    }));

    const detected = detectAnomalies(samplesWithIds);
    const anomalyCount = detected.filter((s) => s.isAnomaly).length;

    set((state) => ({
      samples: [...state.samples, ...detected],
      batches: state.batches.map((b) =>
        b.id === selectedBatchId
          ? { ...b, totalSamples: b.totalSamples + newSamples.length, anomalyCount: b.anomalyCount + anomalyCount }
          : b
      ),
    }));
  },

  addComment: (sampleId, author, content) => {
    const newComment: Comment = {
      id: `comment-${generateId()}`,
      author,
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? {
              ...s,
              comments: [...s.comments, newComment],
              review: s.review
                ? {
                    ...s.review,
                    updatedAt: new Date().toISOString(),
                  }
                : undefined,
            }
          : s
      ),
    }));
  },

  updateSampleStatus: (sampleId, status) => {
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId ? { ...s, status } : s
      ),
    }));
  },

  updateReview: (sampleId, reviewUpdate) => {
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? {
              ...s,
              review: {
                explanation: reviewUpdate.explanation || s.review?.explanation || '',
                missingMaterials: reviewUpdate.missingMaterials || s.review?.missingMaterials || [],
                nextOwner: (reviewUpdate.nextOwner as NextOwner) || s.review?.nextOwner || '模型评测小孟',
                updatedAt: new Date().toISOString(),
              },
            }
          : s
      ),
    }));
  },

  getSampleById: (id) => {
    return get().samples.find((s) => s.id === id);
  },

  getSamplesByBatch: (batchId) => {
    return get().samples.filter((s) => s.batchId === batchId);
  },

  getAnomalySamples: () => {
    return get().samples.filter((s) => s.isAnomaly);
  },
}));
