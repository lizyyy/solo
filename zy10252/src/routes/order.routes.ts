import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';

const router = Router();
const orderController = new OrderController();

router.post('/', orderController.createOrder);
router.get('/', orderController.getAllOrders);
router.get('/:id', orderController.getOrder);
router.get('/no/:orderNo', orderController.getOrderByNo);
router.patch('/:id/status', orderController.updateOrderStatus);
router.post('/:id/outbound', orderController.confirmOutbound);
router.get('/:orderId/summary', orderController.getWeightDifferenceSummary);

export default router;
