import { Router } from 'express';
import { cacheExplanationController } from '../controllers/cacheExplanationController';
import { validateRequest, validateQuery } from '../middleware/errorHandler';
import {
  createExplanationSchema,
  manualCorrectionSchema,
  forceRefreshSchema,
  querySchema,
  recordHitSchema,
  recordFailureSchema
} from '../middleware/validation';

const router = Router();

router.post(
  '/',
  validateRequest(createExplanationSchema),
  cacheExplanationController.createExplanation.bind(cacheExplanationController)
);

router.get(
  '/',
  validateQuery(querySchema),
  cacheExplanationController.queryExplanations.bind(cacheExplanationController)
);

router.get(
  '/:id',
  cacheExplanationController.getExplanationById.bind(cacheExplanationController)
);

router.get(
  '/cache-key/:cacheKey',
  cacheExplanationController.getExplanationByCacheKey.bind(cacheExplanationController)
);

router.get(
  '/:id/report',
  cacheExplanationController.getDetailedReport.bind(cacheExplanationController)
);

router.get(
  '/:id/hit-history',
  cacheExplanationController.getHitHistory.bind(cacheExplanationController)
);

router.patch(
  '/:id/status',
  cacheExplanationController.updateStatus.bind(cacheExplanationController)
);

router.post(
  '/manual-correction',
  validateRequest(manualCorrectionSchema),
  cacheExplanationController.manualCorrection.bind(cacheExplanationController)
);

router.post(
  '/record-hit',
  validateRequest(recordHitSchema),
  cacheExplanationController.recordHit.bind(cacheExplanationController)
);

router.post(
  '/force-refresh',
  validateRequest(forceRefreshSchema),
  cacheExplanationController.forceRefresh.bind(cacheExplanationController)
);

router.post(
  '/record-failure',
  validateRequest(recordFailureSchema),
  cacheExplanationController.recordFailure.bind(cacheExplanationController)
);

router.get(
  '/export/csv',
  cacheExplanationController.exportToCSV.bind(cacheExplanationController)
);

router.get(
  '/export/json',
  cacheExplanationController.exportToJSON.bind(cacheExplanationController)
);

export default router;
