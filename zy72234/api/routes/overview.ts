import { Router } from 'express';
import { OverviewController } from '../controllers/OverviewController.js';

const router = Router();

router.get('/stats', OverviewController.getStats);
router.get('/chart/3d', OverviewController.get3DChartData);
router.get('/chart/pie', OverviewController.getPieChartData);
router.get('/click-target/:adjustmentId', OverviewController.getClickTarget);

export default router;
