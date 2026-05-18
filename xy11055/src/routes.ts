import { Router } from 'express';
import * as applicationController from './controllers/applicationController';

const router = Router();

router.post('/applications', applicationController.createApplication);
router.get('/applications', applicationController.getAllApplications);
router.get('/applications/:id', applicationController.getApplication);
router.post('/applications/:id/approve', applicationController.approveApplication);
router.post('/applications/:id/reject', applicationController.rejectApplication);
router.get('/applications/:id/export', applicationController.exportApplication);

export default router;
