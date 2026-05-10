import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';

const router = Router();

router.get('/summary/:budgetPoolId', ReportController.getBudgetSummary);
router.get('/transactions', ReportController.getTransactions);
router.get('/transactions/export/csv', ReportController.exportTransactionsToCsv);
router.get('/summary/:budgetPoolId/export/csv', ReportController.exportSummaryToCsv);
router.get('/audit-logs', ReportController.getAuditLogs);

export default router;
