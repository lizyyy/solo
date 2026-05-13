import { Router } from 'express';
import * as reportController from '../controllers/reportController';

const router = Router();

router.get('/:projectId', reportController.getReportData);
router.get('/:projectId/export', reportController.exportReport);

export default router;
