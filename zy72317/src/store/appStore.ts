import { create } from 'zustand';
import type { PickingRoute, ScoreWeight, ParameterVersion, SelfCheckResult, ImportBatch } from '../../shared/types';

interface AppState {
  currentUser: string;
  routes: PickingRoute[];
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
  setWeights: (weights: ScoreWeight[]) => void;
  setWeightReviewInfo: (info: any) => void;
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
