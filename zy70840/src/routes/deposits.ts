import { Router, Request, Response } from 'express';
import DepositService from '../services/DepositService';
import { FlowType } from '../models/DepositFlow';
import dayjs from 'dayjs';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const applicationId = req.query.applicationId ? parseInt(req.query.applicationId as string) : undefined;
    const flowType = req.query.flowType as FlowType;
    const operator = req.query.operator as string;
    const startDate = req.query.startDate ? dayjs(req.query.startDate as string).toDate() : undefined;
    const endDate = req.query.endDate ? dayjs(req.query.endDate as string).toDate() : undefined;

    const result = await DepositService.listFlows(page, pageSize, {
      applicationId,
      flowType,
      operator,
      startDate,
      endDate,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/application/:applicationId', async (req: Request, res: Response) => {
  try {
    const flows = await DepositService.getFlowsByApplication(parseInt(req.params.applicationId));
    res.json(flows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deduct', async (req: Request, res: Response) => {
  try {
    const { applicationId, amount, reason, operator } = req.body;

    if (!applicationId || !amount || !operator) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const result = await DepositService.deductDeposit(
      applicationId,
      parseFloat(amount),
      reason,
      operator
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/collect', async (req: Request, res: Response) => {
  try {
    const { applicationId, amount, reason, operator } = req.body;

    if (!applicationId || !amount || !operator) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const result = await DepositService.collectDeposit(
      applicationId,
      parseFloat(amount),
      reason,
      operator
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/refund', async (req: Request, res: Response) => {
  try {
    const { applicationId, reason, operator } = req.body;

    if (!applicationId || !operator) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const result = await DepositService.refundDeposit(
      applicationId,
      reason,
      operator
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/balance/:applicationId', async (req: Request, res: Response) => {
  try {
    const balance = await DepositService.getCurrentBalance(parseInt(req.params.applicationId));
    res.json({ balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
