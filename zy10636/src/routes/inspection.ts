import { Router } from 'express';
import { InspectionController } from '../controllers/InspectionController';

const router = Router();

router.post('/records', InspectionController.createMissedRecord);
router.get('/records', InspectionController.getRecordList);
router.get('/records/:id', InspectionController.getRecordDetail);
router.get('/records/:id/history', InspectionController.getOperationHistory);
router.post('/records/:id/submit', InspectionController.submitSupplement);
router.post('/records/:id/confirm', InspectionController.confirmRecord);
router.post('/records/:id/reject', InspectionController.rejectRecord);
router.post('/records/:id/approve-review', InspectionController.approveManualReview);
router.get('/export/records', InspectionController.exportRecords);
router.get('/export/records/:id', InspectionController.exportRecordDetail);
router.post('/import/records', InspectionController.importRecords);

export default router;
