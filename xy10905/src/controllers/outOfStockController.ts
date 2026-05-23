import { Request, Response } from "express";
import { OutOfStockService } from "../services/OutOfStockService";
import { AllocationService } from "../services/AllocationService";
import { UserConfirmationService } from "../services/UserConfirmationService";
import { SettlementService } from "../services/SettlementService";
import { ExceptionLogService } from "../services/ExceptionLogService";
import { asyncHandler } from "../middleware/errorHandler";

const outOfStockService = new OutOfStockService();
const allocationService = new AllocationService();
const userConfirmationService = new UserConfirmationService();
const settlementService = new SettlementService();
const exceptionLogService = new ExceptionLogService();

export const createOutOfStockItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await outOfStockService.createOutOfStockItem(req.body);
  res.status(201).json({
    success: true,
    data: item,
  });
});

export const getOutOfStockItems = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.query;
  const items = await outOfStockService.getOutOfStockItems(
    batchId ? batchId.toString() : undefined
  );
  res.json({
    success: true,
    data: items,
  });
});

export const getOutOfStockItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await outOfStockService.getOutOfStockItem(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error("缺货商品不存在");
  }
  res.json({
    success: true,
    data: item,
  });
});

export const startAllocation = asyncHandler(async (req: Request, res: Response) => {
  const item = await outOfStockService.startAllocation(req.params.id);
  res.json({
    success: true,
    data: item,
  });
});

export const updateCompensationType = asyncHandler(async (req: Request, res: Response) => {
  const { planId } = req.params;
  const { compensationType, exchangeDetails, pointsAmount } = req.body;
  const plan = await allocationService.updateCompensationType(
    planId,
    compensationType,
    exchangeDetails,
    pointsAmount
  );
  res.json({
    success: true,
    data: plan,
  });
});

export const getCompensationPlans = asyncHandler(async (req: Request, res: Response) => {
  const plans = await allocationService.getCompensationPlans(req.params.outOfStockItemId);
  res.json({
    success: true,
    data: plans,
  });
});

export const confirmCompensation = asyncHandler(async (req: Request, res: Response) => {
  const { idempotencyKey, userId, userRemark } = req.body;
  const confirmation = await userConfirmationService.confirm(
    idempotencyKey,
    userId,
    userRemark
  );
  res.json({
    success: true,
    data: confirmation,
  });
});

export const rejectCompensation = asyncHandler(async (req: Request, res: Response) => {
  const { idempotencyKey, userId, userRemark } = req.body;
  const confirmation = await userConfirmationService.reject(
    idempotencyKey,
    userId,
    userRemark
  );
  res.json({
    success: true,
    data: confirmation,
  });
});

export const manualUpdate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { updates, operatorId, operatorName } = req.body;
  const item = await outOfStockService.manualUpdate(id, updates, operatorId, operatorName);
  res.json({
    success: true,
    data: item,
  });
});

export const markAsCompleted = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { operatorId, operatorName } = req.body;
  const item = await outOfStockService.markAsCompleted(id, operatorId, operatorName);
  res.json({
    success: true,
    data: item,
  });
});

export const cancelOutOfStockItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, operatorId, operatorName } = req.body;
  const item = await outOfStockService.cancel(id, reason, operatorId, operatorName);
  res.json({
    success: true,
    data: item,
  });
});

export const generateSettlementReport = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, generatedBy } = req.body;
  const report = await settlementService.generateReport(batchId, generatedBy);
  res.json({
    success: true,
    data: report,
  });
});

export const getSettlementReports = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.query;
  const reports = await settlementService.getReports(
    batchId ? batchId.toString() : undefined
  );
  res.json({
    success: true,
    data: reports,
  });
});

export const getExceptionLogs = asyncHandler(async (req: Request, res: Response) => {
  const { isResolved } = req.query;
  const logs = await exceptionLogService.getExceptionLogs(
    isResolved !== undefined ? isResolved === "true" : undefined
  );
  res.json({
    success: true,
    data: logs,
  });
});

export const resolveExceptionLog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { resolvedBy, handlingConclusion } = req.body;
  const log = await exceptionLogService.resolveException(id, resolvedBy, handlingConclusion);
  res.json({
    success: true,
    data: log,
  });
});
