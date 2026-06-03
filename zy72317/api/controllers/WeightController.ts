import { Request, Response } from 'express';
import type { WeightReviewRequest } from '../../shared/types';
import { weightService } from '../services/WeightService';

export class WeightController {
  async getWeights(req: Request, res: Response) {
    try {
      const weights = weightService.getAllWeights();
      const reviewInfo = weightService.getReviewInfo();
      return res.json({
        weights,
        reviewInfo,
        isAllReviewed: weightService.isAllReviewed(),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async updateWeight(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { weight } = req.body as { weight: number };
      const result = weightService.updateWeight(id, weight);
      if (!result) {
        return res.status(404).json({ error: '权重配置不存在' });
      }
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async markAsReviewed(req: Request, res: Response) {
    try {
      const { operator, remark } = req.body as WeightReviewRequest;
      const result = weightService.markAsReviewed(operator || '吴老师', remark);
      return res.json({
        weights: result,
        reviewInfo: weightService.getReviewInfo(),
        isAllReviewed: true,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}

export const weightController = new WeightController();
