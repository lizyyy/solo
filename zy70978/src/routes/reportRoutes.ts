import { Router } from 'express';
import * as reportController from '../controllers/reportController';

const router = Router();

router.get('/detailed/:orderNo', reportController.getDetailedReport);
router.get('/summary', reportController.getSummaryReport);
router.get('/export/detailed/:orderNo', reportController.exportDetailedToExcel);
router.get('/export/summary', reportController.exportSummaryToExcel);
router.get('/deduction-evidence/:orderNo', reportController.getDeductionEvidence);

export default router;
