import { Router } from 'express';
import ReportController from '../controllers/ReportController';

const router = Router({ mergeParams: true });

router.post('/', ReportController.generate);
router.get('/', ReportController.get);
router.get('/history', ReportController.history);
router.get('/export', ReportController.export);
router.get('/:reportId', ReportController.getById);

export default router;
