import { Router } from 'express';
import * as exportController from '../controllers/export.controller';

const router = Router();

router.get('/registrations', exportController.exportRegistrations);
router.get('/waitlist', exportController.exportWaitlist);
router.get('/attendance', exportController.exportAttendance);
router.get('/activities/:id/full-report', exportController.exportFullReport);
router.get('/count', exportController.getExportCount);

export default router;
