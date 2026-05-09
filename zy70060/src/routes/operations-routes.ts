import { Router, Request, Response } from 'express';
import { failedOperationService } from '../services/failed-operation-service';

export const operationsRouter = Router();

operationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const operations = await failedOperationService.getAllOperations(
      limit ? parseInt(limit as string) : 100
    );

    res.json({ success: true, data: operations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

operationsRouter.get('/pending', async (req: Request, res: Response) => {
  try {
    const operations = await failedOperationService.getPendingOperations();

    res.json({ success: true, data: operations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

operationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operation = await failedOperationService.getOperationById(id);

    res.json({ success: true, data: operation });
  } catch (error: any) {
    if (error.message.includes('失败操作不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

operationsRouter.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operation = await failedOperationService.getOperationById(id);

    res.json({ 
      success: true, 
      message: '请使用专用脚本或手动执行该操作', 
      data: operation 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});