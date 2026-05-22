import Joi from 'joi';
import {
  InspectionOrder,
  RepairQuote,
  PhotoInventory,
  PreparationStatus,
  RecordSource,
  ValidationError
} from '../types';

export class DataValidator {
  private static inspectionItemSchema = Joi.object({
    code: Joi.string().required().min(1).max(50),
    name: Joi.string().required().min(1).max(200),
    description: Joi.string().required().min(1).max(1000),
    severity: Joi.string().valid('minor', 'medium', 'major').required(),
    estimatedCost: Joi.number().required().min(0).max(999999),
    isRequired: Joi.boolean().required()
  });

  private static inspectionOrderSchema = Joi.object({
    requestId: Joi.string().required().min(1).max(100),
    vin: Joi.string().required().length(17).alphanum(),
    plateNumber: Joi.string().required().min(1).max(20),
    brand: Joi.string().required().min(1).max(100),
    model: Joi.string().required().min(1).max(100),
    year: Joi.number().required().integer().min(1900).max(2100),
    mileage: Joi.number().required().integer().min(0).max(9999999),
    inspectionDate: Joi.number().required().integer().positive(),
    inspectorName: Joi.string().required().min(1).max(100),
    items: Joi.array().items(this.inspectionItemSchema).required().min(1),
    totalCost: Joi.number().required().min(0).max(9999999),
    status: Joi.string().valid(...Object.values(PreparationStatus)).required(),
    remarks: Joi.string().max(2000).optional(),
    createdBy: Joi.string().required().min(1).max(100),
    updatedBy: Joi.string().required().min(1).max(100)
  });

  private static repairItemSchema = Joi.object({
    code: Joi.string().required().min(1).max(50),
    name: Joi.string().required().min(1).max(200),
    description: Joi.string().required().min(1).max(1000),
    partsCost: Joi.number().required().min(0).max(999999),
    laborCost: Joi.number().required().min(0).max(999999),
    quantity: Joi.number().required().integer().min(1).max(9999)
  });

  private static repairQuoteSchema = Joi.object({
    requestId: Joi.string().required().min(1).max(100),
    vin: Joi.string().required().length(17).alphanum(),
    plateNumber: Joi.string().required().min(1).max(20),
    brand: Joi.string().required().min(1).max(100),
    model: Joi.string().required().min(1).max(100),
    year: Joi.number().required().integer().min(1900).max(2100),
    mileage: Joi.number().required().integer().min(0).max(9999999),
    quoteDate: Joi.number().required().integer().positive(),
    repairShop: Joi.string().required().min(1).max(200),
    quoteManager: Joi.string().required().min(1).max(100),
    items: Joi.array().items(this.repairItemSchema).required().min(1),
    laborCost: Joi.number().required().min(0).max(9999999),
    partsCost: Joi.number().required().min(0).max(9999999),
    totalCost: Joi.number().required().min(0).max(9999999),
    estimatedDuration: Joi.number().required().integer().min(1).max(999),
    status: Joi.string().valid(...Object.values(PreparationStatus)).required(),
    remarks: Joi.string().max(2000).optional(),
    createdBy: Joi.string().required().min(1).max(100),
    updatedBy: Joi.string().required().min(1).max(100)
  });

  private static photoItemSchema = Joi.object({
    id: Joi.string().required().min(1).max(100),
    category: Joi.string().valid('damage', 'interior', 'exterior', 'repair_before', 'repair_after').required(),
    url: Joi.string().required().uri().max(500),
    thumbnailUrl: Joi.string().uri().max(500).optional(),
    description: Joi.string().max(500).optional(),
    uploadTime: Joi.number().required().integer().positive()
  });

  private static photoInventorySchema = Joi.object({
    requestId: Joi.string().required().min(1).max(100),
    vin: Joi.string().required().length(17).alphanum(),
    plateNumber: Joi.string().required().min(1).max(20),
    photoDate: Joi.number().required().integer().positive(),
    uploader: Joi.string().required().min(1).max(100),
    photos: Joi.array().items(this.photoItemSchema).required().min(1),
    status: Joi.string().valid(...Object.values(PreparationStatus)).required(),
    remarks: Joi.string().max(2000).optional(),
    createdBy: Joi.string().required().min(1).max(100),
    updatedBy: Joi.string().required().min(1).max(100)
  });

  static validateInspectionOrder(data: any): { valid: boolean; errors: ValidationError[] } {
    const result = this.inspectionOrderSchema.validate(data, { abortEarly: false });
    if (result.error) {
      return {
        valid: false,
        errors: result.error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          rule: detail.type
        }))
      };
    }

    const businessErrors: ValidationError[] = [];
    const calculatedTotal = data.items.reduce((sum: number, item: any) => sum + item.estimatedCost, 0);
    if (Math.abs(calculatedTotal - data.totalCost) > 0.01) {
      businessErrors.push({
        field: 'totalCost',
        message: `总金额 ${data.totalCost} 与明细合计 ${calculatedTotal} 不一致`,
        rule: 'business.totalCost.mismatch'
      });
    }

    return {
      valid: businessErrors.length === 0,
      errors: businessErrors
    };
  }

  static validateRepairQuote(data: any): { valid: boolean; errors: ValidationError[] } {
    const result = this.repairQuoteSchema.validate(data, { abortEarly: false });
    if (result.error) {
      return {
        valid: false,
        errors: result.error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          rule: detail.type
        }))
      };
    }

    const businessErrors: ValidationError[] = [];
    
    const calculatedPartsCost = data.items.reduce((sum: number, item: any) => sum + (item.partsCost * item.quantity), 0);
    if (Math.abs(calculatedPartsCost - data.partsCost) > 0.01) {
      businessErrors.push({
        field: 'partsCost',
        message: `配件总成本 ${data.partsCost} 与明细合计 ${calculatedPartsCost} 不一致`,
        rule: 'business.partsCost.mismatch'
      });
    }

    const calculatedLaborCost = data.items.reduce((sum: number, item: any) => sum + (item.laborCost * item.quantity), 0);
    if (Math.abs(calculatedLaborCost - data.laborCost) > 0.01) {
      businessErrors.push({
        field: 'laborCost',
        message: `人工总成本 ${data.laborCost} 与明细合计 ${calculatedLaborCost} 不一致`,
        rule: 'business.laborCost.mismatch'
      });
    }

    const calculatedTotal = data.partsCost + data.laborCost;
    if (Math.abs(calculatedTotal - data.totalCost) > 0.01) {
      businessErrors.push({
        field: 'totalCost',
        message: `总金额 ${data.totalCost} 与配件+人工合计 ${calculatedTotal} 不一致`,
        rule: 'business.totalCost.mismatch'
      });
    }

    return {
      valid: businessErrors.length === 0,
      errors: businessErrors
    };
  }

  static validatePhotoInventory(data: any): { valid: boolean; errors: ValidationError[] } {
    const result = this.photoInventorySchema.validate(data, { abortEarly: false });
    if (result.error) {
      return {
        valid: false,
        errors: result.error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          rule: detail.type
        }))
      };
    }

    return { valid: true, errors: [] };
  }

  static validateStatusTransition(
    oldStatus: PreparationStatus | undefined,
    newStatus: PreparationStatus
  ): { valid: boolean; message?: string } {
    if (!oldStatus) {
      return { valid: true };
    }

    if (oldStatus === PreparationStatus.AUDIT_ONLY) {
      return { valid: false, message: '只读审计状态不可变更' };
    }

    const validTransitions: Record<PreparationStatus, PreparationStatus[]> = {
      [PreparationStatus.DRAFT]: [
        PreparationStatus.SUBMITTED,
        PreparationStatus.DRAFT
      ],
      [PreparationStatus.SUBMITTED]: [
        PreparationStatus.REJECTED,
        PreparationStatus.SECOND_CONFIRM,
        PreparationStatus.AUDIT_ONLY
      ],
      [PreparationStatus.REJECTED]: [
        PreparationStatus.SUBMITTED,
        PreparationStatus.DRAFT
      ],
      [PreparationStatus.SECOND_CONFIRM]: [
        PreparationStatus.AUDIT_ONLY,
        PreparationStatus.REJECTED
      ],
      [PreparationStatus.AUDIT_ONLY]: []
    };

    const allowed = validTransitions[oldStatus]?.includes(newStatus);
    if (!allowed) {
      return {
        valid: false,
        message: `不允许从 ${oldStatus} 变更到 ${newStatus}`
      };
    }

    return { valid: true };
  }
}

export default DataValidator;
