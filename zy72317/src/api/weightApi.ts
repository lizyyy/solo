import apiClient from './client';
import type { ScoreWeight, WeightReviewRequest } from '../../shared/types';

export const weightApi = {
  getWeights: () => {
    return apiClient.get<{
      weights: ScoreWeight[];
      reviewInfo: { reviewedBy: string | null; reviewedAt: string | null; remark: string | null } | null;
      isAllReviewed: boolean;
    }>('/weights');
  },

  updateWeight: (id: string, weight: number) => {
    return apiClient.put<ScoreWeight>(`/weights/${id}`, { weight });
  },

  markAsReviewed: (data: WeightReviewRequest) => {
    return apiClient.post<{
      weights: ScoreWeight[];
      reviewInfo: { reviewedBy: string; reviewedAt: string; remark: string | null };
      isAllReviewed: boolean;
    }>('/weights/review', data);
  },
};
