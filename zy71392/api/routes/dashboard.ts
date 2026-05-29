import express, { type Request, type Response } from 'express';
import dashboardService from '../services/dashboardService.js';

const router = express.Router();

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = dashboardService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/activities', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const activities = dashboardService.getActivities(limit);
    res.json({ success: true, data: activities });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/permission-distribution', (_req: Request, res: Response) => {
  try {
    const distribution = dashboardService.getPermissionDistribution();
    res.json({ success: true, data: distribution });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
