import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';

const router = Router();

router.get('/', auditController.getAuditLogs);
router.post('/review', auditController.submitReview);

export default router;
