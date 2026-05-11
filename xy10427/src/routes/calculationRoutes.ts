import { Router, Request, Response } from 'express';
import {
  calculateSubsidies,
  processApproval,
  regenerateReport,
} from '../services/calculationService';
import {
  getSummaryByDepartment,
  getApprovalDifferences,
  getPayoutReport,
  getAbnormalDetails,
  getBatchList,
} from '../services/queryService';

const router = Router();

router.post('/calculate', (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd, ruleId } = req.body;
    if (!periodStart || !periodEnd || !ruleId) {
      return res.status(400).json({
        error: '缺少必填字段：periodStart, periodEnd, ruleId',
      });
    }
    const result = calculateSubsidies(periodStart, periodEnd, ruleId);
    res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/approval', (req: Request, res: Response) => {
  try {
    const { calculationId, operator, action, newAmount, reason } = req.body;
    if (!calculationId || !operator || !action || !reason) {
      return res.status(400).json({
        error: '缺少必填字段：calculationId, operator, action, reason',
      });
    }
    if (!['approve', 'reject', 'adjust'].includes(action)) {
      return res.status(400).json({
        error: 'action 只能是 approve, reject, adjust',
      });
    }
    const result = processApproval({
      calculationId,
      operator,
      action: action as any,
      newAmount,
      reason,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/regenerate-report/:batchId', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = regenerateReport(batchId);
    res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batches', (_req: Request, res: Response) => {
  try {
    const batches = getBatchList();
    res.json({
      success: true,
      data: batches,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary/:batchId', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const summary = getSummaryByDepartment(batchId);
    res.json({
      success: true,
      data: summary,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/differences/:batchId', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = getApprovalDifferences(batchId);
    res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/payout-report/:batchId', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const report = getPayoutReport(batchId);
    res.json({
      success: true,
      data: report,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/abnormals/:batchId', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { type } = req.query;
    const abnormals = getAbnormalDetails(batchId, type as string);
    res.json({
      success: true,
      data: abnormals,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
