import express, { type Request, type Response } from 'express';
import riskService from '../services/riskService.js';

const router = express.Router();

router.get('/overview', (_req: Request, res: Response) => {
  try {
    const data = riskService.getOverview();
    res.json({ success: true, data });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dynamic-miss', (_req: Request, res: Response) => {
  try {
    const risks = riskService.getDynamicMissRisks();
    res.json({ success: true, data: risks });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/wildcard-over', (_req: Request, res: Response) => {
  try {
    const risks = riskService.getWildcardRisks();
    res.json({ success: true, data: risks });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exception-long', (_req: Request, res: Response) => {
  try {
    const risks = riskService.getExceptionLongRisks();
    res.json({ success: true, data: risks });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
