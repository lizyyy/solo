import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';

const router = Router();

router.post('/approve/:orderNo', reviewController.approveOrder);
router.post('/reject/:orderNo', reviewController.rejectOrder);
router.post('/request-more-info/:orderNo', reviewController.requestMoreInfo);
router.post('/reset-pending/:orderNo', reviewController.resetToPending);
router.patch('/repair-liability/:repairId', reviewController.updateRepairLiability);
router.post('/bind-repair', reviewController.bindRepairToOrder);
router.post('/unbind-repair/:repairId', reviewController.unbindRepairFromOrder);
router.get('/history/:orderNo', reviewController.getOrderReviewHistory);
router.get('/status-explanation/:status', reviewController.getStatusExplanation);

export default router;
