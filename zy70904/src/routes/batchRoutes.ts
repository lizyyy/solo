import { Router } from 'express';
import { BatchController } from '../controllers/BatchController';

const router = Router();

router.post('/batches', BatchController.createBatch);
router.post('/batches/:batchId/process', BatchController.processBatch);

router.post('/records/:recordId/approve', BatchController.approveRecord);
router.post('/records/:recordId/reject', BatchController.rejectRecord);
router.post('/records/:recordId/return', BatchController.returnRecord);

router.get('/batches', BatchController.getAllBatches);
router.get('/batches/:batchId', BatchController.getBatch);
router.get('/batches/:batchId/records', BatchController.getBatchRecords);
router.get('/batches/:batchId/stats', BatchController.getBatchStats);
router.get('/batches/:batchId/export', BatchController.exportBatchRecords);

router.get('/records/:recordId/explanation', BatchController.getRecordExplanation);
router.get('/records/:recordId/audit-trail', BatchController.getRecordAuditTrail);

router.get('/records/query', BatchController.queryRecords);
router.get('/records/export', BatchController.exportRecords);

router.get('/logs', BatchController.getOperationLogs);

router.post('/activity-rules', BatchController.createActivityRule);
router.get('/activity-rules', BatchController.getAllActivityRules);

export default router;
