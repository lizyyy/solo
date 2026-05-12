import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as refundService from '../services/refund.service';
import { RefundStatus } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const refund = await refundService.createRefund(req.body);
  successResponse(res, refund, '创建退款成功', 201);
});

router.get('/', async (req: Request, res: Response) => {
  const { merchantNo, orderNo, startDate, endDate, status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  
  const result = await refundService.listRefunds(
    merchantNo as string,
    orderNo as string,
    startDate as string,
    endDate as string,
    status as RefundStatus,
    page,
    pageSize
  );
  successResponse(res, result, '获取退款列表成功');
});

router.get('/:id', async (req: Request, res: Response) => {
  const refund = await refundService.getRefundById(req.params.id);
  successResponse(res, refund, '获取退款详情成功');
});

router.get('/no/:refundNo', async (req: Request, res: Response) => {
  const refund = await refundService.getRefundByNo(req.params.refundNo);
  successResponse(res, refund, '获取退款详情成功');
});

export default router;
