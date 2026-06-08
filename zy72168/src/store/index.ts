import { create } from 'zustand';
import type { Point, Feedback, PlanVersion, Report, CrossPeriodData, ConflictDecision, DuplicateGroup } from '@/types';
import { pointService } from '@/services/pointService';
import { feedbackService } from '@/services/feedbackService';
import { planService } from '@/services/planService';
import { reportService } from '@/services/reportService';

interface AppState {
  points: Point[];
  feedbacks: Feedback[];
  plans: PlanVersion[];
  currentReport: Report | null;
  crossPeriodData: CrossPeriodData[];
  loading: boolean;
  error: string | null;
  selectedPointId: string | null;
  selectedFeedbackId: string | null;
  selectedPlanId: string | null;
  mainProcessStep: number;
  fetchPoints: (params?: { status?: string; keyword?: string }) => Promise<void>;
  fetchFeedbacks: (params?: { pointId?: string; status?: string; type?: string }) => Promise<void>;
  fetchPlans: (params?: { pointId?: string }) => Promise<void>;
  generateReport: (timeRange?: { start: string; end: string }) => Promise<void>;
  fetchCrossPeriodData: () => Promise<void>;
  mergePoints: (pointIds: string[], targetName: string) => Promise<void>;
  resolveConflict: (id: string, decision: ConflictDecision, note: string) => Promise<void>;
  mergeDuplicates: (primaryId: string, duplicateIds: string[]) => Promise<void>;
  updateFeedback: (id: string, data: Partial<Feedback>) => Promise<void>;
  setSelectedPointId: (id: string | null) => void;
  setSelectedFeedbackId: (id: string | null) => void;
  setSelectedPlanId: (id: string | null) => void;
  setMainProcessStep: (step: number) => void;
  getDuplicateGroups: () => Promise<DuplicateGroup[]>;
  getMergeCandidates: () => Promise<Point[][]>;
}

export const useAppStore = create<AppState>((set, get) => ({
  points: [],
  feedbacks: [],
  plans: [],
  currentReport: null,
  crossPeriodData: [],
  loading: false,
  error: null,
  selectedPointId: null,
  selectedFeedbackId: null,
  selectedPlanId: null,
  mainProcessStep: 0,

  fetchPoints: async (params) => {
    set({ loading: true, error: null });
    try {
      const points = await pointService.getPoints(params);
      set({ points });
    } catch {
      set({ error: '获取点位数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchFeedbacks: async (params) => {
    set({ loading: true, error: null });
    try {
      const feedbacks = await feedbackService.getFeedbacks(params);
      set({ feedbacks });
    } catch {
      set({ error: '获取反馈数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchPlans: async (params) => {
    set({ loading: true, error: null });
    try {
      const plans = await planService.getPlans(params);
      set({ plans });
    } catch {
      set({ error: '获取方案数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  generateReport: async (timeRange) => {
    set({ loading: true, error: null });
    try {
      const { points, feedbacks, plans } = get();
      const report = await reportService.generateReport(
        { points, feedbacks, plans },
        timeRange,
      );
      set({ currentReport: report });
    } catch {
      set({ error: '生成报告失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchCrossPeriodData: async () => {
    set({ loading: true, error: null });
    try {
      const { points, feedbacks } = get();
      const data = await reportService.getCrossPeriodStats({ points, feedbacks, plans: get().plans });
      set({ crossPeriodData: data });
    } catch {
      set({ error: '获取跨时段统计失败' });
    } finally {
      set({ loading: false });
    }
  },

  mergePoints: async (pointIds, targetName) => {
    set({ loading: true, error: null });
    try {
      await pointService.mergePoints(pointIds, targetName);
      await get().fetchPoints();
    } catch {
      set({ error: '合并点位失败' });
    } finally {
      set({ loading: false });
    }
  },

  resolveConflict: async (id, decision, note) => {
    set({ loading: true, error: null });
    try {
      await feedbackService.resolveConflict(id, decision, note);
      await get().fetchFeedbacks();
    } catch {
      set({ error: '解决冲突失败' });
    } finally {
      set({ loading: false });
    }
  },

  mergeDuplicates: async (primaryId, duplicateIds) => {
    set({ loading: true, error: null });
    try {
      await feedbackService.mergeDuplicates(primaryId, duplicateIds);
      await get().fetchFeedbacks();
    } catch {
      set({ error: '合并重复项失败' });
    } finally {
      set({ loading: false });
    }
  },

  updateFeedback: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await feedbackService.updateFeedback(id, data);
      await get().fetchFeedbacks();
    } catch {
      set({ error: '更新反馈失败' });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedPointId: (id) => set({ selectedPointId: id }),
  setSelectedFeedbackId: (id) => set({ selectedFeedbackId: id }),
  setSelectedPlanId: (id) => set({ selectedPlanId: id }),
  setMainProcessStep: (step) => set({ mainProcessStep: step }),

  getDuplicateGroups: async () => {
    return await feedbackService.getDuplicateGroups();
  },

  getMergeCandidates: async () => {
    return await pointService.getMergeCandidates();
  },
}));
