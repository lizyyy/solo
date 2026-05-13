import { Router } from 'express';
import * as constructionController from '../controllers/constructionController';

const router = Router();

router.get('/project/:projectId', constructionController.getNodes);
router.get('/:id', constructionController.getNodeById);
router.get('/:id/can-complete', constructionController.checkNodeCanComplete);
router.post('/:id/complete', constructionController.completeConstructionNode);
router.post('/:id/deduction', constructionController.processNodeDeduction);
router.get('/deduction/status/:requestId', constructionController.getDeductionStatus);

export default router;
