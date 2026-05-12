import { Router } from 'express';
import { RefundController } from '../controllers/refund.controller';

const router = Router();
const refundController = new RefundController();

router.post('/', refundController.createRefund);
router.post('/weight-difference', refundController.createWeightDifferenceRefund);
router.post('/:id/approve', refundController.approveRefund);
router.post('/:id/reject', refundController.rejectRefund);
router.post('/:id/process', refundController.processRefund);
router.get('/:id', refundController.getRefundRecord);
router.get('/order/:orderId', refundController.getRefundRecordsByOrder);

export default router;
