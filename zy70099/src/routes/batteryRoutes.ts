import { Router, Request, Response } from 'express';
import { batteryService } from '../services/batteryService';
import { LendRequest, ReturnRequest, MaintenanceRequest, ScrapRequest, ApiResponse } from '../types';

const router = Router();

router.post('/batteries', async (req: Request, res: Response) => {
  const { batteryCode, maxCycleCount } = req.body;
  if (!batteryCode) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '电池编号不能为空' },
    } as ApiResponse<null>);
  }

  const result = await batteryService.createBattery(batteryCode, maxCycleCount);
  if (result.success) {
    return res.status(201).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '创建失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.post('/cabinet-slots', async (req: Request, res: Response) => {
  const { cabinetId, slotNumber } = req.body;
  if (!cabinetId || slotNumber === undefined || slotNumber === null) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '柜格信息不完整' },
    } as ApiResponse<null>);
  }

  const result = await batteryService.createCabinetSlot(cabinetId, slotNumber);
  if (result.success) {
    return res.status(201).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '创建失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.post('/batteries/place', async (req: Request, res: Response) => {
  const { batteryCode, cabinetId, slotNumber } = req.body;
  if (!batteryCode || !cabinetId || slotNumber === undefined || slotNumber === null) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '参数不完整' },
    } as ApiResponse<null>);
  }

  const result = await batteryService.placeBatteryInSlot(batteryCode, cabinetId, slotNumber);
  if (result.success) {
    return res.status(200).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '操作失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.post('/transactions/lend', async (req: Request<{}, {}, LendRequest>, res: Response) => {
  const request: LendRequest = req.body;
  if (!request.batteryCode || !request.userId || !request.cabinetId || request.slotNumber === undefined) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '借出参数不完整' },
    } as ApiResponse<null>);
  }

  const result = await batteryService.lendBattery(request);
  if (result.success) {
    return res.status(200).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(result.needsManualReview ? 422 : 400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '借出失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.post('/transactions/return', async (req: Request<{}, {}, ReturnRequest>, res: Response) => {
  const request: ReturnRequest = req.body;
  if (!request.batteryCode || !request.userId || !request.cabinetId || request.slotNumber === undefined) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '归还参数不完整' },
    } as ApiResponse<null>);
  }

  const result = await batteryService.returnBattery(request);
  if (result.success) {
    return res.status(200).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(result.needsManualReview ? 422 : 400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '归还失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.post('/batteries/maintenance', async (req: Request<{}, {}, MaintenanceRequest>, res: Response) => {
  const request: MaintenanceRequest = req.body;
  if (!request.batteryCode) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '电池编号不能为空' },
    } as ApiResponse<null>);
  }

  const result = await batteryService.sendToMaintenance(request);
  if (result.success) {
    return res.status(200).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(result.needsManualReview ? 422 : 400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '维修标记失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.post('/batteries/:batteryCode/complete-maintenance', async (req: Request, res: Response) => {
  const { batteryCode } = req.params;
  const result = await batteryService.completeMaintenance(batteryCode);

  if (result.success) {
    return res.status(200).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(result.needsManualReview ? 422 : 400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '完成维修失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.post('/batteries/scrap', async (req: Request<{}, {}, ScrapRequest>, res: Response) => {
  const request: ScrapRequest = req.body;
  if (!request.batteryCode) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '电池编号不能为空' },
    } as ApiResponse<null>);
  }

  const result = await batteryService.scrapBattery(request);
  if (result.success) {
    return res.status(200).json({ success: true, data: result.data } as ApiResponse<typeof result.data>);
  }

  return res.status(result.needsManualReview ? 422 : 400).json({
    success: false,
    error: {
      code: result.needsManualReview ? 'PENDING_REVIEW' : 'VALIDATION_ERROR',
      message: result.error || '报废失败',
      exceptionId: result.exceptionRecord?.id,
      pendingTaskId: result.pendingTask?.id,
    },
  } as ApiResponse<null>);
});

router.get('/exceptions', async (_req: Request, res: Response) => {
  const exceptions = await batteryService.getUnresolvedExceptions();
  return res.status(200).json({ success: true, data: exceptions } as ApiResponse<typeof exceptions>);
});

router.get('/pending-tasks', async (_req: Request, res: Response) => {
  const tasks = await batteryService.getPendingTasks();
  return res.status(200).json({ success: true, data: tasks } as ApiResponse<typeof tasks>);
});

export default router;
