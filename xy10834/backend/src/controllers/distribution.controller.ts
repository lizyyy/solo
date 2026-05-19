import { Request, Response, NextFunction } from 'express';
import distributionService from '../services/distribution.service';

export async function publishVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await distributionService.publishVersion(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAllVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await distributionService.getAllVersions({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      configId: req.query.configId as string,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await distributionService.getVersions(req.params.configId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getVersionDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await distributionService.getVersionDetail(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function forceRefresh(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await distributionService.forceRefresh(req.params.configId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
