import { Router, Request, Response } from 'express';
import { LeadService } from '../services/LeadService';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await LeadService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

export default router;
