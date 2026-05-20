import { Router, Request, Response } from 'express';
import DepositService from '../services/DepositService';
import { FlowType } from '../models/DepositFlow';
import dayjs from 'dayjs';
import { getQueryNumber, getQueryString } from '../utils/request';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = getQueryNumber(req.query.page) || 1;
    const pageSize = getQueryNumber(req.query.pageSize) || 20;
    const applicationId = getQueryNumber(req.query.applicationId);
    const flowType = getQueryString(req.query.flowType) as FlowType | undefined;
    const operator = getQueryString(req.query.operator);
    const startDateStr = getQueryString(req.query.startDate);
    const endDateStr = getQueryString(req.query.endDate);
    const startDate = startDateStr ? dayjs(startDateStr).toDate() : undefined;
    const endDate = endDateStr ? dayjs(endDateStr).toDate() : undefined;

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
    const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
    const flows = await DepositService.getFlowsByApplication(parseInt(applicationIdParam));
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
    const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
    const balance = await DepositService.getCurrentBalance(parseInt(applicationIdParam));
    res.json({ balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
