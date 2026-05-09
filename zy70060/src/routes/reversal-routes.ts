import { Router, Request, Response } from 'express';
import { reversalService } from '../services/reversal-service';

export const reversalRouter = Router();

reversalRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { transactionId, reason } = req.body;

    if (!transactionId || !reason) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填字段: transactionId, reason' 
      });
    }

    const reversal = await reversalService.createReversal(transactionId, reason);

    res.status(201).json({ 
      success: true, 
      message: '冲正完成', 
      data: reversal 
    });
  } catch (error: any) {
    if (error.message.includes('只能冲正')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('交易不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

reversalRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reversal = await reversalService.getReversalById(id);

    res.json({ success: true, data: reversal });
  } catch (error: any) {
    if (error.message.includes('冲正记录不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

reversalRouter.get('/transaction/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const reversals = await reversalService.getReversalsByTransaction(transactionId);

    res.json({ success: true, data: reversals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reversalRouter.post('/retry-all', async (req: Request, res: Response) => {
  try {
    const result = await reversalService.retryFailedReversals();

    res.json({ 
      success: true, 
      message: '失败冲正重试完成', 
      data: result 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reversalRouter.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reversal = await reversalService.executeReversal(id);

    res.json({ 
      success: true, 
      message: '冲正重试完成', 
      data: reversal 
    });
  } catch (error: any) {
    if (error.message.includes('冲正记录不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});