import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as paymentService from '../services/payment.service';
import { PaymentStatus } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const payment = await paymentService.createPayment(req.body);
  successResponse(res, payment, '创建打款成功', 201);
});

router.get('/', async (req: Request, res: Response) => {
  const { settlementNo, status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  
  const result = await paymentService.listPayments(
    settlementNo as string,
    status as PaymentStatus,
    page,
    pageSize
  );
  successResponse(res, result, '获取打款列表成功');
});

router.get('/:paymentNo', async (req: Request, res: Response) => {
  const payment = await paymentService.getPaymentByNo(req.params.paymentNo);
  successResponse(res, payment, '获取打款详情成功');
});

router.post('/:paymentNo/process', async (req: Request, res: Response) => {
  const payment = await paymentService.processPayment(req.params.paymentNo, req.body.operator);
  successResponse(res, payment, '打款处理中');
});

router.post('/:paymentNo/success', async (req: Request, res: Response) => {
  const payment = await paymentService.confirmPaymentSuccess(req.params.paymentNo, req.body.operator);
  successResponse(res, payment, '打款成功');
});

router.post('/:paymentNo/fail', async (req: Request, res: Response) => {
  const payment = await paymentService.confirmPaymentFailed(req.params.paymentNo, req.body.reason, req.body.operator);
  successResponse(res, payment, '打款失败');
});

router.post('/:paymentNo/retry', async (req: Request, res: Response) => {
  const payment = await paymentService.retryPayment(req.params.paymentNo, req.body.operator);
  successResponse(res, payment, '重新发起打款成功');
});

export default router;
