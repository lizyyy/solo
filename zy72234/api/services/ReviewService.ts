import { z } from 'zod';
import { AdjustmentRepo } from '../db/repositories/AdjustmentRepo.js';
import { ProcessService } from './ProcessService.js';
import type { TailAdjustment, AdjustmentStatus, ReviewRequest } from '../../shared/types.js';

const ReviewSchema = z.object({
  result: z.enum(['normal', 'verify']),
  comment: z.string().min(1, '复核意见不能为空'),
  operator: z.string().min(1, '操作人不能为空'),
});

export const ReviewService = {
  getPendingReviews(): TailAdjustment[] {
    return AdjustmentRepo.findByStatus('pending_review');
  },

  getById(id: string): TailAdjustment | undefined {
    return AdjustmentRepo.findById(id);
  },

  review(
    adjustmentId: string,
    reviewData: ReviewRequest
  ): TailAdjustment {
    const validated = ReviewSchema.parse(reviewData);
    
    const adjustment = AdjustmentRepo.findById(adjustmentId);
    if (!adjustment) {
      throw new Error('调整条不存在');
    }

    if (adjustment.status !== 'pending_review') {
      throw new Error('该调整条状态不是待复核，无法进行风控复核');
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newStatus: AdjustmentStatus = validated.result === 'normal'
      ? 'reviewed_normal'
      : 'needs_verification';

    AdjustmentRepo.updateStatus(
      adjustmentId,
      newStatus,
      now,
      validated.operator,
      validated.comment
    );

    ProcessService.recordReview(adjustmentId, validated.operator, validated.result, validated.comment);

    if (validated.result === 'normal') {
      ProcessService.recordComplete(adjustmentId);
    }

    const updated = AdjustmentRepo.findById(adjustmentId);
    if (!updated) {
      throw new Error('更新失败');
    }

    return updated;
  },

  updateStatusAfterCustody(adjustmentId: string): TailAdjustment {
    const adjustment = AdjustmentRepo.findById(adjustmentId);
    if (!adjustment) {
      throw new Error('调整条不存在');
    }

    if (adjustment.status !== 'pending_custody') {
      throw new Error('该调整条状态不是待补托管页');
    }

    AdjustmentRepo.updateStatus(adjustmentId, 'pending_review');

    const updated = AdjustmentRepo.findById(adjustmentId);
    if (!updated) {
      throw new Error('更新失败');
    }

    return updated;
  },

  getFlaggedAdjustments(): TailAdjustment[] {
    return AdjustmentRepo.findFlagged();
  },

  getAll(): TailAdjustment[] {
    return AdjustmentRepo.findAll();
  },
};
