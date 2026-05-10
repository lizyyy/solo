import { Router } from 'express';
import { approvalController } from '../controllers/approval.controller';

const router = Router();

router.post('/flows', approvalController.validate.createFlow, approvalController.createFlow);
router.get('/flows', approvalController.validate.listFlows, approvalController.listFlows);
router.get('/batches/:id/context', approvalController.validate.getContext, approvalController.getApprovalContext);
router.post('/batches/:id/approve', approvalController.validate.approve, approvalController.approve);
router.post('/batches/:id/reject', approvalController.validate.reject, approvalController.reject);

export default router;
