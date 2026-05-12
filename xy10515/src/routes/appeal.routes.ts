import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as appealService from '../services/appeal.service';
import { AppealStatus } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const appeal = await appealService.createAppeal(req.body);
  successResponse(res, appeal, '创建申诉成功', 201);
});

router.get('/', async (req: Request, res: Response) => {
  const { merchantNo, startDate, endDate, status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  
  const result = await appealService.listAppeals(
    merchantNo as string,
    startDate as string,
    endDate as string,
    status as AppealStatus,
    page,
    pageSize
  );
  successResponse(res, result, '获取申诉列表成功');
});

router.get('/:id', async (req: Request, res: Response) => {
  const appeal = await appealService.getAppealById(req.params.id);
  successResponse(res, appeal, '获取申诉详情成功');
});

router.get('/no/:appealNo', async (req: Request, res: Response) => {
  const appeal = await appealService.getAppealByNo(req.params.appealNo);
  successResponse(res, appeal, '获取申诉详情成功');
});

router.post('/:id/review', async (req: Request, res: Response) => {
  const appeal = await appealService.reviewAppeal(req.params.id, req.body);
  successResponse(res, appeal, '审核申诉成功');
});

export default router;
