import { Router, type Request, type Response } from 'express';
import { AnomalyService } from '../services/AnomalyService.js';
import type { ResolveAnomalyRequest } from '../../shared/types.js';

const router = Router();

const getCurrentUser = (req: Request): string => {
  return (req.headers['x-user'] as string) || 'admin';
};

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeResolved } = req.query;
    const includeResolvedFlag = includeResolved === 'true';
    const anomalies = AnomalyService.getAnomalies(includeResolvedFlag);

    res.status(200).json({
      success: true,
      data: anomalies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取异常列表失败',
    });
  }
});

router.put('/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as ResolveAnomalyRequest;
    const modifiedBy = getCurrentUser(req);

    if (!body.resolution) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: resolution',
      });
      return;
    }

    const anomaly = AnomalyService.resolveAnomaly(id, body.resolution, modifiedBy);

    if (!anomaly) {
      res.status(404).json({
        success: false,
        error: '异常不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: anomaly,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '解决异常失败',
    });
  }
});

export default router;
