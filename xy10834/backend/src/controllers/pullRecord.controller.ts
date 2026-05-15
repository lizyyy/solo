import { Request, Response, NextFunction } from 'express';
import pullRecordService from '../services/pullRecord.service';

export async function reportPullResult(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pullRecordService.reportPullResult(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getPullRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pullRecordService.findAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      configId: req.query.configId as string,
      instanceId: req.query.instanceId as string,
      pullStatus: req.query.pullStatus as any,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getFailedRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pullRecordService.getFailedRecords(req.query.configId as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function retryFailed(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pullRecordService.retryFailed(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function detectOldValues(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pullRecordService.detectOldValues(req.params.configId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
