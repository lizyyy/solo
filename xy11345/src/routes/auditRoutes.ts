import { Router } from 'express';
import * as auditController from '../controllers/auditController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', requireAdmin, auditController.getAuditLogs);

export default router;
