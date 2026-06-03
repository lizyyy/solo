import { Router } from 'express';
import adjustmentRoutes from './adjustments.js';
import custodyRoutes from './custody.js';
import reviewRoutes from './review.js';
import summaryRoutes from './summary.js';
import overviewRoutes from './overview.js';

const router = Router();

router.use('/adjustments', adjustmentRoutes);
router.use('/custody', custodyRoutes);
router.use('/review', reviewRoutes);
router.use('/summary', summaryRoutes);
router.use('/overview', overviewRoutes);

export default router;
