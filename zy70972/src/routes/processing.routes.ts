import { Router } from 'express';
import * as processingController from '../controllers/processing.controller';

const router = Router();

router.post('/registrations/:id/request-materials', processingController.requestMaterials);
router.post('/registrations/:id/approve', processingController.approveRegistration);
router.post('/registrations/:id/reject', processingController.rejectRegistration);
router.post('/registrations/:id/cancel', processingController.cancelRegistration);
router.post('/registrations/:id/review', processingController.reviewRegistration);
router.post('/waitlist/promote', processingController.promoteWaitlist);
router.get('/history', processingController.getProcessingHistory);

export default router;
