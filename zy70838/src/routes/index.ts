import { Router } from 'express';
import multer from 'multer';
import { importController } from '../controllers/ImportController';
import { reconciliationController } from '../controllers/ReconciliationController';
import { reportController } from '../controllers/ReportController';

const router = Router();

const upload = multer({ dest: 'uploads/' });

router.post('/import/borrow-records', upload.single('file'), importController.importBorrowRecords);
router.post('/import/vehicles', upload.single('file'), importController.importVehicles);
router.post('/import/violations', upload.single('file'), importController.importViolations);

router.post('/reconciliation/run', reconciliationController.runReconciliation);
router.get('/reconciliation/discrepancies', reconciliationController.getDiscrepancies);
router.get('/reconciliation/discrepancies/:id', reconciliationController.getDiscrepancy);
router.post('/reconciliation/discrepancies/:id/review', reconciliationController.reviewDiscrepancy);
router.post('/reconciliation/recalculate', reconciliationController.recalculate);

router.get('/reconciliation/reports', reconciliationController.getReports);
router.get('/reconciliation/reports/:id', reconciliationController.getReport);
router.post('/reconciliation/reports/:id/finalize', reconciliationController.finalizeReport);

router.post('/reports/:reportId/export/excel', reportController.exportToExcel);
router.get('/reports/:reportId/download/excel', reportController.downloadExcel);

router.get('/traceability/:recordId', reportController.getTraceability);
router.get('/audit-log/:recordId', reportController.getAuditLog);

router.get('/borrow-records', reportController.getBorrowRecords);
router.get('/vehicles', reportController.getVehicles);
router.get('/violations', reportController.getViolations);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '4S店试驾车对账服务运行正常',
    timestamp: new Date().toISOString()
  });
});

export default router;
