import { Router, Request, Response } from 'express';
import { repairService } from '../services/repairService';
import { asyncHandler } from '../middleware/errorHandler';
import { CreateRepairRequest, UpdateRepairRequest, MergeRepairsRequest } from '../types/repair';

const router = Router();

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const request: CreateRepairRequest = req.body;
  const repair = await repairService.createRepair(request);
  res.status(201).json({
    success: true,
    data: repair
  });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const repairs = await repairService.getAllRepairs();
  res.json({
    success: true,
    data: repairs
  });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const repair = await repairService.getRepair(req.params.id);
  res.json({
    success: true,
    data: repair
  });
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const request: UpdateRepairRequest = req.body;
  const repair = await repairService.updateRepair(req.params.id, request);
  res.json({
    success: true,
    data: repair
  });
}));

router.post('/merge', asyncHandler(async (req: Request, res: Response) => {
  const request: MergeRepairsRequest = req.body;
  const result = await repairService.mergeRepairs(request);
  res.json({
    success: true,
    data: {
      targetRepair: result.target,
      mergedRepairs: result.merged
    }
  });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await repairService.deleteRepair(req.params.id);
  res.json({
    success: true,
    message: '报修记录已删除'
  });
}));

export default router;
