import { Router } from 'express';
import RecordController from '../controllers/RecordController';

const router = Router();

router.get('/', RecordController.getAllRecords);
router.get('/:id', RecordController.getRecordById);
router.post('/import', RecordController.importRecords);
router.put('/:id/reconciliation', RecordController.updateReconciliationNote);
router.put('/:id/mark-modification', RecordController.markAsManualModification);
router.post('/:id/review', RecordController.reviewRecord);
router.post('/:id/rerun', RecordController.rerunReconciliation);
router.get('/:id/reviews', RecordController.getReviewHistory);

export default router;
