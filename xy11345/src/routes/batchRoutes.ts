import { Router } from 'express';
import * as batchController from '../controllers/batchController';
import { requireQCOrAdmin } from '../middleware/auth';

const router = Router();

router.post('/import', batchController.importBatch);
router.post('/batch-import', batchController.batchImport);
router.post('/judgment', requireQCOrAdmin, batchController.performJudgment);
router.post('/review', requireQCOrAdmin, batchController.performReview);
router.post('/rework', batchController.recordRework);
router.post('/quality-order', requireQCOrAdmin, batchController.generateQualityOrder);
router.get('/trend', batchController.getTrendData);
router.get('/:batchNumber', batchController.getBatch);
router.get('/', batchController.getBatches);
router.patch('/:batchNumber/complete', requireQCOrAdmin, batchController.markBatchComplete);
router.post('/export', batchController.exportBatches);
router.get('/:batchNumber/export', batchController.exportBatchDetail);
router.get('/:batchNumber/quality-order/pdf', batchController.exportQualityOrderPdf);

export default router;
