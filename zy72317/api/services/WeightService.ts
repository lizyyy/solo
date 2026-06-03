import type { ScoreWeight } from '../../shared/types';
import { weightRepository } from '../repositories/WeightRepository';

export class WeightService {
  getAllWeights(): ScoreWeight[] {
    return weightRepository.findAll();
  }

  updateWeight(id: string, weight: number): ScoreWeight | null {
    if (weight < 0 || weight > 100) {
      throw new Error('权重值必须在0-100之间');
    }
    return weightRepository.updateWeight(id, weight);
  }

  markAsReviewed(operator: string, remark?: string): ScoreWeight[] {
    return weightRepository.markAsReviewed(operator, remark);
  }

  isAllReviewed(): boolean {
    return weightRepository.isAllReviewed();
  }

  getReviewInfo(): { reviewedBy: string | null; reviewedAt: string | null; remark: string | null } | null {
    return weightRepository.getReviewInfo();
  }
}

export const weightService = new WeightService();
