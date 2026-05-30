import { Router, type Request, type Response } from 'express';
import { ShadowService } from '../services/ShadowService.js';
import type { DrillConfig } from '../../shared/types.js';

const router = Router();

const getCurrentUser = (req: Request): string => {
  return (req.headers['x-user'] as string) || 'admin';
};

router.post('/drill', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as DrillConfig;
    const modifiedBy = getCurrentUser(req);

    if (!body.ruleId || !body.ruleVersion || !body.startTime || !body.endTime || !body.sampleRate) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: ruleId, ruleVersion, startTime, endTime, sampleRate',
      });
      return;
    }

    if (typeof body.ruleVersion !== 'number' || body.ruleVersion <= 0) {
      res.status(400).json({
        success: false,
        error: 'ruleVersion 必须是大于 0 的数字',
      });
      return;
    }

    if (typeof body.sampleRate !== 'number' || body.sampleRate <= 0 || body.sampleRate > 1) {
      res.status(400).json({
        success: false,
        error: 'sampleRate 必须是 0 到 1 之间的数字',
      });
      return;
    }

    const drill = await ShadowService.runDrill(body);

    res.status(201).json({
      success: true,
      data: drill,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '发起演练失败',
    });
  }
});

router.get('/drill/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const drill = ShadowService.getDrillResult(id);

    if (!drill) {
      res.status(404).json({
        success: false,
        error: '演练不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: drill,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取演练结果失败',
    });
  }
});

router.get('/hit-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId, startTime, endTime, page, pageSize } = req.query as {
      ruleId?: string;
      startTime?: string;
      endTime?: string;
      page?: string;
      pageSize?: string;
    };

    const params = {
      ruleId,
      startTime,
      endTime,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    };

    const analysis = ShadowService.getHitAnalysis(params);

    res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取命中分析失败',
    });
  }
});

export default router;
