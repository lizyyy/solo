import { Router } from 'express';
import { visitorController } from '../controllers/visitorController';

const router = Router();

router.post('/', visitorController.createVisitor);
router.get('/', visitorController.getAllVisitors);
router.get('/:id', visitorController.getVisitor);
router.get('/:id/history', visitorController.getVisitorHistory);
router.get('/:id/access-controls', visitorController.getVisitorAccessControls);
router.post('/:id/submit', visitorController.submitVisitor);
router.post('/:id/approve', visitorController.approveVisitor);
router.post('/:id/reject', visitorController.rejectVisitor);
router.post('/:id/withdraw', visitorController.withdrawVisitor);
router.post('/:id/resubmit', visitorController.resubmitVisitor);
router.put('/:id/modify', visitorController.modifyVisitor);
router.post('/:id/change-floor', visitorController.changeVisitorFloor);
router.post('/:id/comment', visitorController.addComment);
router.get('/:id/export', visitorController.exportVisitorData);

export default router;
