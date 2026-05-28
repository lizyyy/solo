import { Router, type Request, type Response } from 'express';
import { repaymentService } from '../services/repaymentService.js';

const router = Router();

const mockUser = {
  id: 'u001',
  name: '张明',
};

router.get('/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const { businessNo, writeOffStatus } = req.query;

    const filters = {
      businessNo: businessNo as string | undefined,
      writeOffStatus: writeOffStatus as string | undefined,
    };

    const result = await repaymentService.getRepaymentList(page, pageSize, filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取回款列表失败',
    });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessNo, repaymentDate, totalAmount, principalPaid, interestPaid, penaltyPaid, payer, remark } = req.body;

    if (!businessNo || !repaymentDate || !totalAmount) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    if (totalAmount <= 0) {
      res.status(400).json({
        success: false,
        error: '回款金额必须大于0',
      });
      return;
    }

    const repaymentId = await repaymentService.registerRepayment(
      {
        businessNo,
        repaymentDate,
        totalAmount,
        payer: payer || '',
        remark: remark || '',
      } as any,
      { id: mockUser.id, name: mockUser.name } as any,
    );

    res.json({
      success: true,
      data: { id: repaymentId },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '登记回款失败',
    });
  }
});

router.post('/write-off', async (req: Request, res: Response): Promise<void> => {
  try {
    const { repaymentId, targetType, targetId, amount } = req.body;

    if (!repaymentId || !targetType || !targetId || !amount) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        error: '核销金额必须大于0',
      });
      return;
    }

    await repaymentService.writeOffRepayment(
      repaymentId,
      [{ targetType, targetId, amount }],
      { id: mockUser.id, name: mockUser.name } as any,
    );

    res.json({
      success: true,
      data: { status: 'completed' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '核销回款失败',
    });
  }
});

export default router;
