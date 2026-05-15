import { Router } from 'express';
import { SubmissionController } from '../controllers/SubmissionController';
import { RuleController } from '../controllers/RuleController';
import { ReportController } from '../controllers/ReportController';
import { DependencyChangeController } from '../controllers/DependencyChangeController';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: '依赖器合约服务运行正常', timestamp: new Date().toISOString() });
});

router.post('/submissions', SubmissionController.createSubmission);
router.get('/submissions', SubmissionController.getSubmissions);
router.get('/submissions/:id', SubmissionController.getSubmission);
router.post('/submissions/:id/process', SubmissionController.processSubmission);
router.patch('/submissions/:id', SubmissionController.updateSubmissionField);

router.get('/batches', SubmissionController.getAllBatches);
router.get('/batches/:batchId/stats', SubmissionController.getBatchStats);
router.get('/batches/:batchId/preview/:actionType', SubmissionController.previewBatchAction);
router.post('/batches/:batchId/process', SubmissionController.processBatch);

router.post('/rules', RuleController.createRule);
router.get('/rules', RuleController.getAllRules);
router.get('/rules/active', RuleController.getActiveRule);
router.get('/rules/by-date', RuleController.getRuleByDate);
router.get('/rules/:id', RuleController.getRule);

router.get('/reports', ReportController.getAllReports);
router.get('/reports/:id', ReportController.getReport);
router.get('/reports/batch/:batchId', ReportController.getReportsByBatch);
router.post('/reports/batch/:batchId/generate', ReportController.generateBatchReport);

router.post('/dependency-changes', DependencyChangeController.createChange);
router.get('/dependency-changes', DependencyChangeController.getAllChanges);
router.get('/dependency-changes/:id', DependencyChangeController.getChange);
router.post('/dependency-changes/:id/approve', DependencyChangeController.approveChange);
router.post('/dependency-changes/:id/reject', DependencyChangeController.rejectChange);

export default router;
