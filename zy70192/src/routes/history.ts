import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import * as historyService from '../services/historyService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { entityType, startTime, endTime, operator, page, pageSize } = req.query;
    
    const result = historyService.getAllHistory(
      entityType as any,
      startTime as string,
      endTime as string,
      operator as string,
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json(successResponse(result));
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json(errorResponse('获取历史记录失败'));
  }
});

export default router;
