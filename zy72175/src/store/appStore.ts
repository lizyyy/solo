
import { create } from 'zustand';
import { Sample, DetectionResult, ReviewRecord, Report, TrendData } from '../types';
import { mockSamples, mockDetections, mockReviews, mockReport, mockTrendData } from '../data/mockData';

interface AppState {
  samples: Sample[];
  detections: DetectionResult[];
  reviews: ReviewRecord[];
  report: Report;
  trendData: TrendData[];
  selectedSampleId: string | null;
  isRunningDetection: boolean;

  setSelectedSampleId: (id: string | null) => void;
  getSampleById: (id: string) => Sample | undefined;
  getDetectionBySampleId: (sampleId: string) => DetectionResult | undefined;
  getReviewBySampleId: (sampleId: string) => ReviewRecord | undefined;

  runDetection: () => Promise<void>;
  updateSampleStatus: (sampleId: string, status: Sample['status']) => void;
  addReview: (review: Omit<ReviewRecord, 'id' | 'reviewedAt'>) => void;
  updateReviewRemark: (sampleId: string, remark: string) => void;
  generateReport: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  samples: mockSamples,
  detections: mockDetections,
  reviews: mockReviews,
  report: mockReport,
  trendData: mockTrendData,
  selectedSampleId: null,
  isRunningDetection: false,

  setSelectedSampleId: (id) => set({ selectedSampleId: id }),

  getSampleById: (id) => get().samples.find((s) => s.id === id),

  getDetectionBySampleId: (sampleId) => get().detections.find((d) => d.sampleId === sampleId),

  getReviewBySampleId: (sampleId) => get().reviews.find((r) => r.sampleId === sampleId),

  runDetection: async () => {
    set({ isRunningDetection: true });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    set((state) => ({
      samples: state.samples.map((s) =>
        s.status === 'pending' ? { ...s, status: 'detected', updatedAt: new Date().toISOString() } : s
      ),
      isRunningDetection: false,
    }));
  },

  updateSampleStatus: (sampleId, status) =>
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId ? { ...s, status, updatedAt: new Date().toISOString() } : s
      ),
    })),

  addReview: (review) =>
    set((state) => ({
      reviews: [
        ...state.reviews,
        {
          ...review,
          id: `R${Date.now()}`,
          reviewedAt: new Date().toISOString(),
        },
      ],
    })),

  updateReviewRemark: (sampleId, remark) =>
    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.sampleId === sampleId
          ? {
              ...r,
              isRemarkAdded: true,
              remarkDiff: {
                before: r.remark || '',
                after: remark,
              },
              remark,
            }
          : r
      ),
    })),

  generateReport: () => {
    const state = get();
    const totalSamples = state.samples.length;
    const modelDecision = state.samples.filter(
      (s) => s.status === 'completed' && !state.reviews.find((r) => r.sampleId === s.id && r.finalIntent !== state.detections.find((d) => d.sampleId === s.id)?.modelIntent)
    ).length;
    const manualCorrection = state.reviews.filter(
      (r) => r.finalIntent !== state.detections.find((d) => d.sampleId === r.sampleId)?.modelIntent
    ).length;
    const needReview = state.samples.filter((s) => s.status !== 'completed').length;
    const driftSamples = state.detections.filter((d) => d.isDrift).length;
    const driftRate = totalSamples > 0 ? (driftSamples / totalSamples) * 100 : 0;

    set((state) => ({
      report: {
        ...state.report,
        id: `REP${Date.now()}`,
        generatedAt: new Date().toISOString(),
        statistics: {
          totalSamples,
          modelDecision,
          manualCorrection,
          needReview,
          driftRate,
        },
      },
    }));
  },
}));
