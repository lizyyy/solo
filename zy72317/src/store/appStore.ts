import { create } from 'zustand';
import type { PickingRoute, ScoreWeight, ParameterVersion, SelfCheckResult, ImportBatch, GapRecord } from '../../shared/types';

interface AppState {
  currentUser: string;
  routes: PickingRoute[];
  openGaps: GapRecord[];
  openGapCount: number;
  weights: ScoreWeight[];
  weightReviewInfo: { reviewedBy: string | null; reviewedAt: string | null; remark: string | null } | null;
  isWeightReviewed: boolean;
  versions: ParameterVersion[];
  selfCheckResult: SelfCheckResult | null;
  importBatches: ImportBatch[];
  selectedRouteId: string | null;
  showChangeLog: boolean;
  loading: boolean;
  error: string | null;

  setCurrentUser: (user: string) => void;
  setRoutes: (routes: PickingRoute[]) => void;
  setOpenGaps: (gaps: GapRecord[]) => void;
  setOpenGapCount: (count: number) => void;
  setRoutesData: (data: { routes: PickingRoute[]; openGaps: GapRecord[]; openGapCount: number }) => void;
  setWeights: (weights: ScoreWeight[]) => void;
  setWeightReviewInfo: (info: AppState['weightReviewInfo']) => void;
  setIsWeightReviewed: (reviewed: boolean) => void;
  setVersions: (versions: ParameterVersion[]) => void;
  setSelfCheckResult: (result: SelfCheckResult | null) => void;
  setImportBatches: (batches: ImportBatch[]) => void;
  setSelectedRouteId: (id: string | null) => void;
  setShowChangeLog: (show: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: '吴老师',
  routes: [],
  openGaps: [],
  openGapCount: 0,
  weights: [],
  weightReviewInfo: null,
  isWeightReviewed: false,
  versions: [],
  selfCheckResult: null,
  importBatches: [],
  selectedRouteId: null,
  showChangeLog: false,
  loading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  setRoutes: (routes) => set({ routes }),
  setOpenGaps: (openGaps) => set({ openGaps }),
  setOpenGapCount: (openGapCount) => set({ openGapCount }),
  setRoutesData: (data) => set({
    routes: data.routes,
    openGaps: data.openGaps,
    openGapCount: data.openGapCount,
  }),
  setWeights: (weights) => set({ weights }),
  setWeightReviewInfo: (info) => set({ weightReviewInfo: info }),
  setIsWeightReviewed: (reviewed) => set({ isWeightReviewed: reviewed }),
  setVersions: (versions) => set({ versions }),
  setSelfCheckResult: (result) => set({ selfCheckResult: result }),
  setImportBatches: (batches) => set({ importBatches: batches }),
  setSelectedRouteId: (id) => set({ selectedRouteId: id }),
  setShowChangeLog: (show) => set({ showChangeLog: show }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
