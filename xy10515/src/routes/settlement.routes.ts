import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as settlementService from '../services/settlement.service';
import { SettlementStatus } from '../types';

const router = Router();

router.post('/calculate', async (req: Request, res: Response) => {
  const result = await settlementService.calculateSettlement(req.body);
  successResponse(res, result, '计算结算单成功');
});

router.post('/', async (req: Request, res: Response) => {
  const settlement = await settlementService.createSettlement(req.body);
  successResponse(res, settlement, '创建结算单成功', 201);
});

router.get('/', async (req: Request, res: Response) => {
  const { merchantNo, period, status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  
  const result = await settlementService.listSettlements(
    merchantNo as string,
    period as string,
    status as SettlementStatus,
    page,
    pageSize
  );
  successResponse(res, result, '获取结算单列表成功');
});

router.get('/:id', async (req: Request, res: Response) => {
  const settlement = await settlementService.getSettlementById(req.params.id);
  successResponse(res, settlement, '获取结算单详情成功');
});

router.get('/no/:settlementNo', async (req: Request, res: Response) => {
  const settlement = await settlementService.getSettlementByNo(req.params.settlementNo);
  successResponse(res, settlement, '获取结算单详情成功');
});

router.post('/:id/recalculate', async (req: Request, res: Response) => {
  const settlement = await settlementService.recalculateSettlement(req.params.id, req.body.operator);
  successResponse(res, settlement, '重新计算结算单成功');
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  const settlement = await settlementService.confirmSettlement(req.params.id, req.body);
  successResponse(res, settlement, '确认结算成功');
});

router.post('/:id/freeze', async (req: Request, res: Response) => {
  const settlement = await settlementService.freezeSettlement(req.params.id, req.body);
  successResponse(res, settlement, '冻结结算成功');
});

router.post('/:id/unfreeze', async (req: Request, res: Response) => {
  const settlement = await settlementService.unfreezeSettlement(req.params.id, req.body.reason, req.body.operator);
  successResponse(res, settlement, '解冻结算成功');
});

router.post('/:id/manual-adjust', async (req: Request, res: Response) => {
  const result = await settlementService.manualAdjustment(req.params.id, req.body);
  successResponse(res, result, '人工调整成功');
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  const settlement = await settlementService.cancelSettlement(req.params.id, req.body.reason, req.body.operator);
  successResponse(res, settlement, '取消结算成功');
});

export default router;
