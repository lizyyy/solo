import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';

const router = Router();

router.post('/batches', reviewController.createBatch);
router.get('/batches', reviewController.getAllBatches);
router.get('/batches/:batchId', reviewController.getBatch);
router.get('/batches/:batchId/reviews', reviewController.getReviewsByBatch);

router.post('/samples', reviewController.createSample);
router.get('/samples/:sampleId', reviewController.getSampleWithReviews);

router.post('/reviews', reviewController.createReview);
router.get('/reviews/:reviewId', reviewController.getReview);
router.patch('/reviews/:reviewId/status', reviewController.updateReviewStatus);
router.patch('/reviews/:reviewId/correct', reviewController.manualCorrection);
router.patch('/reviews/:reviewId/exception', reviewController.handleException);

router.post('/reports/generate/:batchId', reviewController.generateReport);
router.post('/reports/export/batch', reviewController.exportBatchReport);
router.post('/reports/export/sample/:sampleId', reviewController.exportSampleReport);

export default router;
