import { Router } from 'express';
import AuditController from '../controllers/AuditController';

const router = Router();

router.get('/', AuditController.getAllAuditLogs);
router.get('/record/:recordId', AuditController.getAuditLogsByRecordId);

export default router;
