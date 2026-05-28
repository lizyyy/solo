import { Router, type Request, type Response } from 'express';
import { auditService } from '../services/auditService.js';

const router = Router();

router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const { action, targetType, userId, startDate, endDate } = req.query;

    const filters = {
      action: action as string | undefined,
      targetType: targetType as string | undefined,
      userId: userId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    };

    const result = await auditService.getAuditLogs(filters, page, pageSize);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取审计日志失败',
    });
  }
});

export default router;
