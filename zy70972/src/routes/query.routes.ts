import { Router } from 'express';
import * as queryController from '../controllers/query.controller';

const router = Router();

router.get('/registrations', queryController.getRegistrations);
router.get('/registrations/:id', queryController.getRegistrationDetail);
router.get('/waitlist', queryController.getWaitlistEntries);
router.get('/attendance', queryController.getAttendanceRecords);
router.get('/activities/:id/summary', queryController.getActivitySummary);
router.get('/processing-history', queryController.getProcessingHistory);
router.get('/audit-logs', queryController.getAuditLogs);

export default router;
