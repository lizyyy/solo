import { Router } from 'express';
import { explanationController } from './controllers/explanation.controller';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'FeatureFlag 命中解释 API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

router.post('/explanations', explanationController.createExplanation.bind(explanationController));
router.get('/explanations/:reportId', explanationController.getReport.bind(explanationController));
router.get('/explanations', explanationController.queryReports.bind(explanationController));
router.post('/explanations/:reportId/advance-status', explanationController.advanceStatus.bind(explanationController));
router.post('/explanations/manual-correct', explanationController.manualCorrect.bind(explanationController));
router.get('/explanations/export', explanationController.exportReports.bind(explanationController));
router.get('/explanations/:reportId/export', explanationController.exportSingleReport.bind(explanationController));

router.get('/flags', explanationController.getAllFlags.bind(explanationController));
router.get('/flags/:flagName', explanationController.getFlag.bind(explanationController));

export default router;
