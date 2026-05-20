import { Router } from 'express';
import multer from 'multer';
import { ReconciliationController } from './controllers/ReconciliationController';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const controller = new ReconciliationController();

router.post('/import/critical-values', upload.single('file'), controller.importCriticalValues.bind(controller));
router.post('/import/callbacks', controller.importCallbacks.bind(controller));
router.post('/import/duty-schedules', upload.single('file'), controller.importDutySchedules.bind(controller));

router.post('/reconciliation/run', controller.runReconciliation.bind(controller));
router.get('/reconciliation', controller.getReconciliationResults.bind(controller));
router.get('/reconciliation/:id', controller.getReconciliationDetail.bind(controller));

router.post('/reconciliation/:id/confirm', controller.reviewAndConfirm.bind(controller));
router.post('/reconciliation/:id/modify', controller.modifyCallback.bind(controller));
router.post('/reconciliation/:id/dismiss', controller.dismissDiscrepancy.bind(controller));
router.get('/reconciliation/:id/history', controller.getReviewHistory.bind(controller));

router.get('/report/summary', controller.getSummaryReport.bind(controller));
router.get('/report/export/reconciliation', controller.exportReconciliationCSV.bind(controller));
router.get('/report/export/discrepancy', controller.exportDiscrepancyCSV.bind(controller));

router.delete('/data/clear', controller.clearAllData.bind(controller));

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'critical-value-reconciliation' });
});

export default router;
