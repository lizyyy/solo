import { Router } from 'express';
import * as batchController from './controllers/batchController';
import * as ruleController from './controllers/ruleController';
import * as reviewController from './controllers/reviewController';
import * as reportController from './controllers/reportController';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: '数据抽样复核 API',
    version: '1.0.0',
    endpoints: {
      rules: '/api/rules',
      batches: '/api/batches',
      reviews: '/api/reviews',
      reports: '/api/reports',
    },
  });
});

router.post('/rules', ruleController.createRule);
router.get('/rules', ruleController.listRules);
router.get('/rules/:ruleId', ruleController.getRule);
router.put('/rules/:ruleId', ruleController.updateRule);
router.delete('/rules/:ruleId', ruleController.deleteRule);

router.post('/batches', batchController.createBatch);
router.get('/batches', batchController.listBatches);
router.get('/batches/:batchId', batchController.getBatch);
router.post('/batches/:batchId/import', batchController.importRecords);
router.post('/batches/:batchId/sampling', batchController.executeSampling);

router.post('/reviews/:batchId/start', reviewController.startReview);
router.post('/reviews/conclusions', reviewController.submitConclusion);
router.post('/reviews/correct', reviewController.manualCorrect);
router.get('/reviews/:batchId/stats', reviewController.getReviewStats);
router.get('/reviews/:batchId/failures', reviewController.getFailRecords);

router.post('/reports/:batchId/generate', reportController.generateReport);
router.get('/reports', reportController.listReports);
router.get('/reports/:reportId', reportController.getReport);
router.get('/reports/:reportId/download', reportController.downloadReport);

export default router;
