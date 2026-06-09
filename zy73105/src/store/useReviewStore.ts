import { create } from 'zustand';
import type { ConclusionChange, ConclusionStatus, FilterTab, ReviewRecord } from '../types/review';
import { mockReviews } from '../data/mockReviews';

interface ReviewState {
  reviews: ReviewRecord[];
  activeFilter: FilterTab;
  setActiveFilter: (f: FilterTab) => void;
  getById: (id: string) => ReviewRecord | undefined;
  getFiltered: () => ReviewRecord[];
  updateConclusion: (
    reviewId: string,
    newStatus: ConclusionStatus,
    reason: string,
    changedBy?: string,
  ) => void;
  getAllHistory: () => (ConclusionChange & { reviewId: string; projectName: string })[];
  getStats: () => {
    total: number;
    confirmed: number;
    pending: number;
    returned: number;
    lateAttachment: number;
    layerIssue: number;
  };
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  reviews: mockReviews,
  activeFilter: 'all',

  setActiveFilter: (f) => set({ activeFilter: f }),

  getById: (id) => get().reviews.find((r) => r.id === id),

  getFiltered: () => {
    const { reviews, activeFilter } = get();
    switch (activeFilter) {
      case 'all':
        return reviews;
      case 'confirmed':
        return reviews.filter((r) => r.conclusionStatus === 'confirmed');
      case 'pending-material':
        return reviews.filter((r) => r.conclusionStatus === 'pending-material');
      case 'returned':
        return reviews.filter((r) => r.conclusionStatus === 'returned');
      case 'late-attachment':
        return reviews.filter((r) => r.attachments.some((a) => a.isLate));
      case 'layer-issue':
        return reviews.filter((r) => r.layerIssues.length > 0);
      default:
        return reviews;
    }
  },

  updateConclusion: (reviewId, newStatus, reason, changedBy = '老叶') => {
    set((state) => {
      const reviews = state.reviews.map((r) => {
        if (r.id !== reviewId) return r;
        const change: ConclusionChange = {
          id: `H-${reviewId}-${Date.now()}`,
          changedAt: new Date().toISOString(),
          changedBy,
          fromStatus: r.conclusionStatus,
          toStatus: newStatus,
          changeReason: reason,
        };
        return {
          ...r,
          conclusionStatus: newStatus,
          history: [change, ...r.history],
        };
      });
      return { reviews };
    });
  },

  getAllHistory: () => {
    const { reviews } = get();
    const all: (ConclusionChange & { reviewId: string; projectName: string })[] = [];
    reviews.forEach((r) => {
      r.history.forEach((h) => {
        all.push({ ...h, reviewId: r.id, projectName: r.projectName });
      });
    });
    return all.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  },

  getStats: () => {
    const { reviews } = get();
    return {
      total: reviews.length,
      confirmed: reviews.filter((r) => r.conclusionStatus === 'confirmed').length,
      pending: reviews.filter((r) => r.conclusionStatus === 'pending-material').length,
      returned: reviews.filter((r) => r.conclusionStatus === 'returned').length,
      lateAttachment: reviews.filter((r) => r.attachments.some((a) => a.isLate)).length,
      layerIssue: reviews.filter((r) => r.layerIssues.length > 0).length,
    };
  },
}));
