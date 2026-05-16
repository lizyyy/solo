import { Router } from 'express';
import * as demoController from '../controllers/demo.controller';

const router = Router();

router.post('/sample-batch', demoController.createSampleBatch);
router.post('/batches', demoController.createDemoBatch);
router.get('/batches', demoController.getDemoBatchList);
router.get('/batches/:id', demoController.getDemoBatchDetail);
router.post('/batches/:id/execute', demoController.executeDemoBatch);
router.get('/batches/:id/report', demoController.getDemoBatchReport);
router.post('/review', demoController.submitDemoReview);
router.get('/rules', demoController.getDemoRules);
router.get('/rules/active', demoController.getDemoActiveRule);
router.get('/rules/:version/explanation', demoController.getDemoRuleExplanation);
router.put('/rules/switch', demoController.switchDemoRuleVersion);
router.get('/audit-logs', demoController.getDemoAuditLogs);

export default router;
