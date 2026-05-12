import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as penaltyService from '../services/penalty.service';
import { PenaltyStatus, PenaltyType } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const penalty = await penaltyService.createPenalty(req.body);
  successResponse(res, penalty, '创建扣罚成功', 201);
});

router.get('/', async (req: Request, res: Response) => {
  const { merchantNo, startDate, endDate, status, type } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  
  const result = await penaltyService.listPenalties(
    merchantNo as string,
    startDate as string,
    endDate as string,
    status as PenaltyStatus,
    type as PenaltyType,
    page,
    pageSize
  );
  successResponse(res, result, '获取扣罚列表成功');
});

router.get('/:id', async (req: Request, res: Response) => {
  const penalty = await penaltyService.getPenaltyById(req.params.id);
  successResponse(res, penalty, '获取扣罚详情成功');
});

router.get('/no/:penaltyNo', async (req: Request, res: Response) => {
  const penalty = await penaltyService.getPenaltyByNo(req.params.penaltyNo);
  successResponse(res, penalty, '获取扣罚详情成功');
});

router.put('/:id/status', async (req: Request, res: Response) => {
  const penalty = await penaltyService.updatePenaltyStatus(req.params.id, req.body);
  successResponse(res, penalty, '更新扣罚状态成功');
});

export default router;
