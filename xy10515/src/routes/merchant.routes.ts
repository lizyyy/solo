import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as merchantService from '../services/merchant.service';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const merchant = await merchantService.createMerchant(req.body);
  successResponse(res, merchant, '创建商户成功', 201);
});

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  
  const result = await merchantService.listMerchants(page, pageSize);
  successResponse(res, result, '获取商户列表成功');
});

router.get('/:id', async (req: Request, res: Response) => {
  const merchant = await merchantService.getMerchantById(req.params.id);
  successResponse(res, merchant, '获取商户详情成功');
});

router.get('/no/:merchantNo', async (req: Request, res: Response) => {
  const merchant = await merchantService.getMerchantByNo(req.params.merchantNo);
  successResponse(res, merchant, '获取商户详情成功');
});

router.put('/:id', async (req: Request, res: Response) => {
  const merchant = await merchantService.updateMerchant(req.params.id, req.body);
  successResponse(res, merchant, '更新商户成功');
});

export default router;
