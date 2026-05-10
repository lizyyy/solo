import { Router } from 'express';
import { reportController } from '../controllers/report.controller';

const router = Router();

router.get('/summary', reportController.validate.summary, reportController.getBatchSummary);
router.get('/trend', reportController.validate.trend, reportController.getDailyTrend);
router.get('/accounts', reportController.validate.account, reportController.getAccountReport);
router.get('/status', reportController.getStatusBreakdown);
router.get('/refunds', reportController.validate.refund, reportController.getRefundSummary);

export default router;
