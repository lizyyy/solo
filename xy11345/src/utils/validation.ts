import * as Joi from 'joi';
import { BatchStatus, ReviewResult } from '../types';
import { ReworkType } from '../models/ReworkRecord';

export const labValueSchema = Joi.object({
  L: Joi.number().min(0).max(100).required(),
  a: Joi.number().min(-128).max(127).required(),
  b: Joi.number().min(-128).max(127).required(),
  tolerance: Joi.number().min(0).max(10).default(2.0),
  measurePoint: Joi.string().max(50).optional(),
  measureOrder: Joi.number().integer().min(1).default(1),
});

export const printBatchImportSchema = Joi.object({
  batchNumber: Joi.string().max(100).required(),
  productName: Joi.string().max(200).required(),
  customerName: Joi.string().max(100).optional(),
  paperBatchNumber: Joi.string().max(100).optional(),
  quantity: Joi.number().integer().min(0).optional(),
  productionDate: Joi.date().optional(),
  machineId: Joi.string().max(100).optional(),
  operator: Joi.string().max(100).optional(),
  standardLabValues: Joi.object({
    L: Joi.number().min(0).max(100).required(),
    a: Joi.number().min(-128).max(127).required(),
    b: Joi.number().min(-128).max(127).required(),
    tolerance: Joi.number().min(0).max(10).default(2.0),
  }).optional(),
  labRecords: Joi.array().items(labValueSchema).min(1).required(),
  remark: Joi.string().optional(),
});

export const judgmentSchema = Joi.object({
  batchNumber: Joi.string().max(100).required(),
  isPassed: Joi.boolean().required(),
  remark: Joi.string().optional(),
  judgeName: Joi.string().max(100).optional(),
});

export const reviewSchema = Joi.object({
  batchNumber: Joi.string().max(100).required(),
  reviewResult: Joi.string().valid(...Object.values(ReviewResult)).required(),
  remark: Joi.string().optional(),
  reviewerName: Joi.string().max(100).optional(),
});

export const reworkSchema = Joi.object({
  batchNumber: Joi.string().max(100).required(),
  reworkType: Joi.string().valid(...Object.values(ReworkType)).required(),
  reason: Joi.string().required(),
  solution: Joi.string().optional(),
  reworkedQuantity: Joi.number().integer().min(0).optional(),
  scrappedQuantity: Joi.number().integer().min(0).optional(),
  operator: Joi.string().max(100).optional(),
  beforeLabValues: labValueSchema.optional(),
  afterLabValues: labValueSchema.optional(),
});

export const qualityOrderSchema = Joi.object({
  batchNumber: Joi.string().max(100).required(),
  inspector: Joi.string().max(100).optional(),
  sampleCount: Joi.number().integer().min(0).optional(),
  passCount: Joi.number().integer().min(0).optional(),
  failCount: Joi.number().integer().min(0).optional(),
  inspectionItems: Joi.string().optional(),
  defectDescription: Joi.string().optional(),
  conclusion: Joi.string().optional(),
});

export function calculateDeltaE(
  lab1: { L: number; a: number; b: number },
  lab2: { L: number; a: number; b: number }
): number {
  const deltaL = lab1.L - lab2.L;
  const deltaA = lab1.a - lab2.a;
  const deltaB = lab1.b - lab2.b;
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

export function validateLabRecord(
  record: { L: number; a: number; b: number },
  standard: { L: number; a: number; b: number; tolerance: number }
): { deltaE: number; isWithinTolerance: boolean } {
  const deltaE = calculateDeltaE(record, standard);
  return {
    deltaE: parseFloat(deltaE.toFixed(2)),
    isWithinTolerance: deltaE <= standard.tolerance,
  };
}

export function validateBatchStatusTransition(
  currentStatus: BatchStatus,
  targetStatus: BatchStatus
): boolean {
  const validTransitions: Record<BatchStatus, BatchStatus[]> = {
    [BatchStatus.IMPORTED]: [BatchStatus.PENDING_JUDGMENT, BatchStatus.IMPORTED],
    [BatchStatus.PENDING_JUDGMENT]: [BatchStatus.PASSED, BatchStatus.FAILED, BatchStatus.PENDING_REVIEW],
    [BatchStatus.PASSED]: [BatchStatus.PENDING_REVIEW, BatchStatus.COMPLETED],
    [BatchStatus.FAILED]: [BatchStatus.PENDING_REVIEW, BatchStatus.REWORKED],
    [BatchStatus.PENDING_REVIEW]: [BatchStatus.REVIEWED, BatchStatus.PASSED, BatchStatus.FAILED, BatchStatus.REWORKED],
    [BatchStatus.REVIEWED]: [BatchStatus.COMPLETED, BatchStatus.REWORKED],
    [BatchStatus.REWORKED]: [BatchStatus.PENDING_JUDGMENT, BatchStatus.COMPLETED],
    [BatchStatus.COMPLETED]: [],
  };

  return validTransitions[currentStatus]?.includes(targetStatus) || currentStatus === targetStatus;
}

export function generateImportKey(data: Record<string, any>): string {
  const keyData = {
    batchNumber: data.batchNumber,
    productionDate: data.productionDate,
    labCount: data.labRecords?.length || 0,
  };
  return Buffer.from(JSON.stringify(keyData)).toString('base64');
}
