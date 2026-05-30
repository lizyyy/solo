import { Router } from 'express';
import { getAuditLogs } from '../controllers/AuditController.js';

const router = Router();

router.get('/logs', getAuditLogs);

export default router;
