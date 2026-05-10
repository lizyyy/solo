import { Router } from 'express';
import { getPayments, createPayment } from '../controllers/paymentController';

const router = Router();

router.get('/', getPayments);
router.post('/', createPayment);

export default router;
