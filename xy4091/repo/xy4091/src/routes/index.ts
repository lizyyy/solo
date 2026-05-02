import { Router } from 'express';
import wardsRouter from './wards';
import bloodBagsRouter from './bloodBags';
import applicationsRouter from './applications';
import auditRouter from './audit';
import reportsRouter from './reports';

const router = Router();

router.use('/wards', wardsRouter);
router.use('/blood-bags', bloodBagsRouter);
router.use('/applications', applicationsRouter);
router.use('/audit', auditRouter);
router.use('/reports', reportsRouter);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: '血袋临期调拨台',
      version: '1.0.0',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
