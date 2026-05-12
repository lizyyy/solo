import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as orderService from '../services/order.service';
import { OrderStatus } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.body);
  successResponse(res, order, '创建订单成功', 201);
});

router.get('/', async (req: Request, res: Response) => {
  const { merchantNo, startDate, endDate, status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  
  const result = await orderService.listOrders(
    merchantNo as string,
    startDate as string,
    endDate as string,
    status as OrderStatus,
    page,
    pageSize
  );
  successResponse(res, result, '获取订单列表成功');
});

router.get('/:id', async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(req.params.id);
  successResponse(res, order, '获取订单详情成功');
});

router.get('/no/:orderNo', async (req: Request, res: Response) => {
  const order = await orderService.getOrderByNo(req.params.orderNo);
  successResponse(res, order, '获取订单详情成功');
});

export default router;
