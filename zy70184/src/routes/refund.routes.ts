import { Router } from 'express';
import { refundController } from '../controllers/refund.controller';

const router = Router();

router.post('/', refundController.validate.create, refundController.createRefund);
router.get('/', refundController.validate.list, refundController.listRefunds);
router.get('/:id', refundController.validate.get, refundController.getRefund);

export default router;
