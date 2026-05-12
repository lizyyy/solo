import { Router } from 'express';
import orderRoutes from './order.routes';
import weightRoutes from './weight.routes';
import refundRoutes from './refund.routes';

const router = Router();

router.use('/orders', orderRoutes);
router.use('/weight', weightRoutes);
router.use('/refunds', refundRoutes);

export default router;
