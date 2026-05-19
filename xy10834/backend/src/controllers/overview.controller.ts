import { Request, Response, NextFunction } from 'express';
import overviewService from '../services/overview.service';

export async function getStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await overviewService.getStatistics();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getRecentActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await overviewService.getRecentActivity(limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getFailedDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await overviewService.getFailedDetails();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
