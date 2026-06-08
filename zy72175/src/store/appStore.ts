
import { create } from 'zustand';
import { Sample, DetectionResult, ReviewRecord, Report, TrendData } from '../types';
import { mockSamples, mockDetections, mockReviews, mockReport, mockTrendData } from '../data/mockData';

const STORAGE_KEY = 'intent_drift_monitor_state';

function loadFromStorage(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveToStorage(state: AppState) {
  try {
    const toSave = {
      samples: state.samples,
      detections: state.detections,
      reviews: state.reviews,
      report: state.report,
      trendData: state.trendData,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

function classifySamples(
  samples: Sample[],
  detections: DetectionResult[],
  reviews: ReviewRecord[]
): { modelDecision: string[]; manualCorrection: string[]; needReview: string[] } {
  const modelDecision: string[] = [];
  const manualCorrection: string[] = [];
  const needReview: string[] = [];

  for (const sample of samples) {
    const review = reviews.find((r) => r.sampleId === sample.id);
    const detection = detections.find((d) => d.sampleId === sample.id);

    if (sample.status === 'completed') {
      if (review && detection && review.finalIntent !== detection.modelIntent) {
        manualCorrection.push(sample.id);
      } else {
        modelDecision.push(sample.id);
      }
    } else {
      needReview.push(sample.id);
    }
  }

  return { modelDecision, manualCorrection, needReview };
}

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
  importSamples: (newSamples: Sample[], newDetections: DetectionResult[]) => void;
  resetToDefault: () => void;
}

const saved = loadFromStorage();

export const useAppStore = create<AppState>((set, get) => ({
  samples: saved?.samples ?? mockSamples,
  detections: saved?.detections ?? mockDetections,
  reviews: saved?.reviews ?? mockReviews,
  report: saved?.report ?? mockReport,
  trendData: saved?.trendData ?? mockTrendData,
  selectedSampleId: null,
  isRunningDetection: false,

  setSelectedSampleId: (id) => set({ selectedSampleId: id }),

  getSampleById: (id) => get().samples.find((s) => s.id === id),

  getDetectionBySampleId: (sampleId) => get().detections.find((d) => d.sampleId === sampleId),

  getReviewBySampleId: (sampleId) => get().reviews.find((r) => r.sampleId === sampleId),

  runDetection: async () => {
    set({ isRunningDetection: true });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    set((state) => {
      const updated = {
        samples: state.samples.map((s) =>
          s.status === 'pending' ? { ...s, status: 'detected' as const, updatedAt: new Date().toISOString() } : s
        ),
        isRunningDetection: false,
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    });
  },

  updateSampleStatus: (sampleId, status) =>
    set((state) => {
      const updated = {
        samples: state.samples.map((s) =>
          s.id === sampleId ? { ...s, status, updatedAt: new Date().toISOString() } : s
        ),
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    }),

  addReview: (review) =>
    set((state) => {
      const updated = {
        reviews: [
          ...state.reviews,
          {
            ...review,
            id: `R${Date.now()}`,
            reviewedAt: new Date().toISOString(),
          },
        ],
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    }),

  updateReviewRemark: (sampleId, remark) =>
    set((state) => {
      const updated = {
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
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    }),

  generateReport: () => {
    const state = get();
    const totalSamples = state.samples.length;
    const classified = classifySamples(state.samples, state.detections, state.reviews);
    const driftSamples = state.detections.filter((d) => d.isDrift).length;
    const driftRate = totalSamples > 0 ? Math.round((driftSamples / totalSamples) * 1000) / 10 : 0;

    const updated = {
      report: {
        id: `REP${Date.now()}`,
        name: `${new Date().toISOString().split('T')[0]} 客服意图漂移检测报告`,
        generatedAt: new Date().toISOString(),
        statistics: {
          totalSamples,
          modelDecision: classified.modelDecision.length,
          manualCorrection: classified.manualCorrection.length,
          needReview: classified.needReview.length,
          driftRate,
        },
        samples: classified,
      },
    };
    set((state) => {
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    });
  },

  importSamples: (newSamples, newDetections) =>
    set((state) => {
      const existingIds = new Set(state.samples.map((s) => s.id));
      const filteredSamples = newSamples.filter((s) => !existingIds.has(s.id));
      const filteredDetections = newDetections.filter(
        (d) => !existingIds.has(d.sampleId) && filteredSamples.some((s) => s.id === d.sampleId)
      );
      const updated = {
        samples: [...state.samples, ...filteredSamples],
        detections: [...state.detections, ...filteredDetections],
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    }),

  resetToDefault: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      samples: mockSamples,
      detections: mockDetections,
      reviews: mockReviews,
      report: mockReport,
      trendData: mockTrendData,
    });
  },
}));
