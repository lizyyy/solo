import { Router, type Request, type Response } from 'express';
import {
  getOverview,
  getQuotaDetail,
  getHedgingDetail,
  getBudgetDetail,
  getReport,
  getAnomalies,
  getConflicts,
  getTrace,
  resolveAnomaly,
  resolveConflict,
  importData,
} from '../services/carbonService.js';

const router = Router();

router.get('/overview', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2025-Q2';
    const data = getOverview(period);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/quota', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2025-Q2';
    const data = getQuotaDetail(period);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/hedging', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2025-Q2';
    const data = getHedgingDetail(period);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/budget', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2025-Q2';
    const data = getBudgetDetail(period);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/report', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2025-Q2';
    const sections = ((req.query.sections as string) || 'overview,quota,hedging,budget').split(',');
    const includeTrace = req.query.trace === 'true';
    const data = getReport(period, sections, includeTrace);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/anomalies', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2025-Q2';
    const data = getAnomalies(period);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/conflicts', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2025-Q2';
    const data = getConflicts(period);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/trace/:targetType/:targetId', (req: Request, res: Response) => {
  try {
    const data = getTrace(req.params.targetType, req.params.targetId);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.patch('/anomaly/:id', (req: Request, res: Response) => {
  try {
    const data = resolveAnomaly(req.params.id, req.body.resolution);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.patch('/conflict/:id', (req: Request, res: Response) => {
  try {
    const data = resolveConflict(req.params.id, req.body.resolution);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/import', (req: Request, res: Response) => {
  try {
    const { source, period, data } = req.body;
    if (!source || !period || !Array.isArray(data)) {
      res.status(400).json({ success: false, error: '缺少必要参数: source, period, data' });
      return;
    }
    const result = importData(source, period, data);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
