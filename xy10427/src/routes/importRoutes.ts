import { Router, Request, Response } from 'express';
import {
  importEmployees,
  importShifts,
  importConsumptions,
  importSubsidyRule,
} from '../services/importService';

const router = Router();

router.post('/employees', (req: Request, res: Response) => {
  try {
    const employees = req.body;
    if (!Array.isArray(employees)) {
      return res.status(400).json({ error: '请求体必须是员工数组' });
    }
    const result = importEmployees(employees);
    res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/shifts', (req: Request, res: Response) => {
  try {
    const shifts = req.body;
    if (!Array.isArray(shifts)) {
      return res.status(400).json({ error: '请求体必须是班次数组' });
    }
    const result = importShifts(shifts);
    res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/consumptions', (req: Request, res: Response) => {
  try {
    const consumptions = req.body;
    if (!Array.isArray(consumptions)) {
      return res.status(400).json({ error: '请求体必须是消费流水数组' });
    }
    const result = importConsumptions(consumptions);
    res.json({
      success: true,
      data: {
        inserted: result.inserted,
        skipped: result.skipped,
        idempotent: result.skipped > 0,
        errors: result.errors,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/subsidy-rules', (req: Request, res: Response) => {
  try {
    const rule = req.body;
    if (!rule.ruleId || !rule.name) {
      return res.status(400).json({ error: '缺少必填字段：ruleId, name' });
    }
    const result = importSubsidyRule(rule);
    res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
