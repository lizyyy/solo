import { Router } from 'express';
import { employeesRouter } from './employees';
import { payrollsRouter } from './payrolls';
import { batchesRouter } from './batches';
import { performanceRouter } from './performance';

const router = Router();

router.use('/employees', employeesRouter);
router.use('/payrolls', payrollsRouter);
router.use('/batches', batchesRouter);
router.use('/performance', performanceRouter);

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});

export { router as apiRouter };
