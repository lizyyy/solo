import { Router, type Request, type Response } from 'express';
import { historyService } from '../services/historyService.js';

const router = Router();

router.get('/changes', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const { recordId, recordType, operatorId, startDate, endDate } = req.query;

    const filters = {
      recordId: recordId as string | undefined,
      recordType: recordType as string | undefined,
      operatorId: operatorId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    };

    const result = await historyService.getChanges(page, pageSize, filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取变更记录失败',
    });
  }
});

export default router;
