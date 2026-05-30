import { Router, type Request, type Response } from 'express';
import { DashboardService } from '../services/DashboardService.js';

const router = Router();

router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = DashboardService.getDashboardStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计数据失败',
    });
  }
});

export default router;
