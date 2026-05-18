import express from 'express';
import { db } from '../store/database';

const router = express.Router();

router.get('/', (req, res) => {
  const orders = db.getOrders();
  res.json({
    success: true,
    data: orders,
    message: '查询成功'
  });
});

router.get('/:id', (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.json({
      success: false,
      message: '订单不存在',
      errorCode: 'ORDER_NOT_FOUND'
    });
  }
  res.json({
    success: true,
    data: order,
    message: '查询成功'
  });
});

export default router;