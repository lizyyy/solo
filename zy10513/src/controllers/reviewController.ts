import { Request, Response } from 'express';
import { ReviewService } from '../services/ReviewService';

const reviewService = new ReviewService();

export const startReview = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = await reviewService.startReview(batchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const submitConclusion = async (req: Request, res: Response) => {
  try {
    const result = await reviewService.submitConclusion(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const manualCorrect = async (req: Request, res: Response) => {
  try {
    const result = await reviewService.manualCorrect(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getReviewStats = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const stats = await reviewService.getBatchReviewStats(batchId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getFailRecords = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { page, pageSize } = req.query;
    const result = await reviewService.getFailRecordsWithTrace(
      batchId,
      page ? parseInt(page as string) : undefined,
      pageSize ? parseInt(pageSize as string) : undefined
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
