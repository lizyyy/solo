import { Router } from 'express';
import { ExportController } from '../controllers/ExportController';

const router = Router();
const controller = new ExportController();

router.get('/excel/:id', controller.exportExcel);
router.get('/conflict-report/:id', controller.exportConflictReport);
router.get('/conflict-report-text/:id', controller.getConflictReportText);

export default router;
