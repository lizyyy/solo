import Joi from 'joi';
import { ReasonCategory, RecalculationStatus } from '../types';

export class ValidationService {
  private createApplicationSchema = Joi.object({
    idempotencyKey: Joi.string().required().messages({
      'string.empty': '幂等键不能为空',
      'any.required': '幂等键是必填项'
    }),
    billingMonth: Joi.string().pattern(/^\d{4}-\d{2}$/).required().messages({
      'string.pattern.base': '账单月份格式必须为 YYYY-MM',
      'any.required': '账单月份是必填项'
    }),
    customerAccount: Joi.string().required().messages({
      'string.empty': '客户账号不能为空',
      'any.required': '客户账号是必填项'
    }),
    customerName: Joi.string().required().messages({
      'string.empty': '客户名称不能为空',
      'any.required': '客户名称是必填项'
    }),
    reasonCategory: Joi.string().valid(...Object.values(ReasonCategory)).required().messages({
      'any.only': '原因分类必须是有效的枚举值',
      'any.required': '原因分类是必填项'
    }),
    reasonDetail: Joi.string().min(10).required().messages({
      'string.min': '原因详情至少需要10个字符',
      'string.empty': '原因详情不能为空',
      'any.required': '原因详情是必填项'
    }),
    triggerSource: Joi.string().required().messages({
      'string.empty': '触发来源不能为空',
      'any.required': '触发来源是必填项'
    }),
    impactDetails: Joi.array().items(
      Joi.object({
        itemCode: Joi.string().required(),
        itemName: Joi.string().required(),
        originalAmount: Joi.number().required(),
        newAmount: Joi.number().required(),
        remarks: Joi.string().allow('').optional()
      })
    ).min(1).required().messages({
      'array.min': '至少需要一条影响明细',
      'any.required': '影响明细是必填项'
    }),
    createdBy: Joi.string().required().messages({
      'string.empty': '创建人不能为空',
      'any.required': '创建人是必填项'
    })
  });

  private updateStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(RecalculationStatus)).required(),
    approver: Joi.string().required(),
    approverRole: Joi.string().required(),
    opinion: Joi.string().required()
  });

  private manualCorrectionSchema = Joi.object({
    totalNewAmount: Joi.number().required(),
    impactDetails: Joi.array().items(
      Joi.object({
        id: Joi.string().optional(),
        itemCode: Joi.string().required(),
        itemName: Joi.string().required(),
        originalAmount: Joi.number().required(),
        newAmount: Joi.number().required(),
        remarks: Joi.string().allow('').optional()
      })
    ).min(1).required(),
    correctedBy: Joi.string().required(),
    correctionReason: Joi.string().required()
  });

  validateCreateApplication(data: any): { error?: string; value?: any } {
    const { error, value } = this.createApplicationSchema.validate(data, { abortEarly: false });
    if (error) {
      return {
        error: error.details.map(d => d.message).join('; ')
      };
    }
    return { value };
  }

  validateUpdateStatus(data: any): { error?: string; value?: any } {
    const { error, value } = this.updateStatusSchema.validate(data, { abortEarly: false });
    if (error) {
      return {
        error: error.details.map(d => d.message).join('; ')
      };
    }
    return { value };
  }

  validateManualCorrection(data: any): { error?: string; value?: any } {
    const { error, value } = this.manualCorrectionSchema.validate(data, { abortEarly: false });
    if (error) {
      return {
        error: error.details.map(d => d.message).join('; ')
      };
    }
    return { value };
  }

  validateStatusTransition(currentStatus: RecalculationStatus, newStatus: RecalculationStatus): boolean {
    const validTransitions: Record<RecalculationStatus, RecalculationStatus[]> = {
      [RecalculationStatus.DRAFT]: [RecalculationStatus.PENDING_APPROVAL],
      [RecalculationStatus.PENDING_APPROVAL]: [RecalculationStatus.APPROVED, RecalculationStatus.REJECTED],
      [RecalculationStatus.APPROVED]: [RecalculationStatus.PROCESSING, RecalculationStatus.NEEDS_MANUAL_CORRECTION],
      [RecalculationStatus.PROCESSING]: [RecalculationStatus.COMPLETED, RecalculationStatus.FAILED, RecalculationStatus.NEEDS_MANUAL_CORRECTION],
      [RecalculationStatus.NEEDS_MANUAL_CORRECTION]: [RecalculationStatus.PENDING_APPROVAL],
      [RecalculationStatus.REJECTED]: [RecalculationStatus.PENDING_APPROVAL],
      [RecalculationStatus.FAILED]: [RecalculationStatus.PENDING_APPROVAL],
      [RecalculationStatus.COMPLETED]: []
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }
}