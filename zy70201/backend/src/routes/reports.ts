import { Router } from 'express';
import { reportController } from '../controllers/reportController';

const router = Router();

router.get('/', reportController.getAllReports);
router.get('/export', reportController.exportReports);
router.post('/', reportController.createReport);
router.get('/:id', reportController.getReportById);
router.post('/:id/approve', reportController.approveReport);

export default router;
