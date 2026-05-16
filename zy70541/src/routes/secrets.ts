import { Router } from 'express';
import secretController from '../controllers/SecretController';
import { validateBody } from '../middleware/validate';
import { ApproveReplacementSchema } from '../utils/validation';

const router = Router();

// Replacement plans management - 与Technical文档路径一致
router.put('/:id/approve', validateBody(ApproveReplacementSchema), secretController.approveReplacement);
router.put('/:id/reject', validateBody(ApproveReplacementSchema), secretController.rejectReplacement);
router.put('/:id/execute', secretController.executeReplacement);

export default router;
