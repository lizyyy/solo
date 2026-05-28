import { Router, type Request, type Response } from 'express';
import { riskService } from '../services/riskService.js';

const router = Router();

router.get('/version-compare', async (req: Request, res: Response): Promise<void> => {
  try {
    const { recordId, recordType, version1, version2 } = req.query;

    if (!recordId || !recordType || !version1 || !version2) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    const v1 = parseInt(version1 as string);
    const v2 = parseInt(version2 as string);

    if (isNaN(v1) || isNaN(v2)) {
      res.status(400).json({
        success: false,
        error: '版本号必须是数字',
      });
      return;
    }

    const result = await riskService.compareVersions(
      recordId as string,
      v1,
      v2,
      recordType as any,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '版本对比失败',
    });
  }
});

router.get('/regression', async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessNo } = req.query;

    const result = await riskService.analyzeRegression(
      businessNo ? (businessNo as string) : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '状态倒退分析失败',
    });
  }
});

router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await riskService.getDashboardStats();

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取风险仪表盘数据失败',
    });
  }
});

export default router;
