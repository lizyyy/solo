"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
const joi_1 = __importDefault(require("joi"));
const types_1 = require("../types");
class ValidationService {
    constructor() {
        this.createApplicationSchema = joi_1.default.object({
            idempotencyKey: joi_1.default.string().required().messages({
                'string.empty': '幂等键不能为空',
                'any.required': '幂等键是必填项'
            }),
            billingMonth: joi_1.default.string().pattern(/^\d{4}-\d{2}$/).required().messages({
                'string.pattern.base': '账单月份格式必须为 YYYY-MM',
                'any.required': '账单月份是必填项'
            }),
            customerAccount: joi_1.default.string().required().messages({
                'string.empty': '客户账号不能为空',
                'any.required': '客户账号是必填项'
            }),
            customerName: joi_1.default.string().required().messages({
                'string.empty': '客户名称不能为空',
                'any.required': '客户名称是必填项'
            }),
            reasonCategory: joi_1.default.string().valid(...Object.values(types_1.ReasonCategory)).required().messages({
                'any.only': '原因分类必须是有效的枚举值',
                'any.required': '原因分类是必填项'
            }),
            reasonDetail: joi_1.default.string().min(10).required().messages({
                'string.min': '原因详情至少需要10个字符',
                'string.empty': '原因详情不能为空',
                'any.required': '原因详情是必填项'
            }),
            triggerSource: joi_1.default.string().required().messages({
                'string.empty': '触发来源不能为空',
                'any.required': '触发来源是必填项'
            }),
            impactDetails: joi_1.default.array().items(joi_1.default.object({
                itemCode: joi_1.default.string().required(),
                itemName: joi_1.default.string().required(),
                originalAmount: joi_1.default.number().required(),
                newAmount: joi_1.default.number().required(),
                remarks: joi_1.default.string().allow('').optional()
            })).min(1).required().messages({
                'array.min': '至少需要一条影响明细',
                'any.required': '影响明细是必填项'
            }),
            createdBy: joi_1.default.string().required().messages({
                'string.empty': '创建人不能为空',
                'any.required': '创建人是必填项'
            })
        });
        this.updateStatusSchema = joi_1.default.object({
            status: joi_1.default.string().valid(...Object.values(types_1.RecalculationStatus)).required(),
            approver: joi_1.default.string().required(),
            approverRole: joi_1.default.string().required(),
            opinion: joi_1.default.string().required()
        });
        this.manualCorrectionSchema = joi_1.default.object({
            totalNewAmount: joi_1.default.number().required(),
            impactDetails: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string().optional(),
                itemCode: joi_1.default.string().required(),
                itemName: joi_1.default.string().required(),
                originalAmount: joi_1.default.number().required(),
                newAmount: joi_1.default.number().required(),
                remarks: joi_1.default.string().allow('').optional()
            })).min(1).required(),
            correctedBy: joi_1.default.string().required(),
            correctionReason: joi_1.default.string().required()
        });
    }
    validateCreateApplication(data) {
        const { error, value } = this.createApplicationSchema.validate(data, { abortEarly: false });
        if (error) {
            return {
                error: error.details.map(d => d.message).join('; ')
            };
        }
        return { value };
    }
    validateUpdateStatus(data) {
        const { error, value } = this.updateStatusSchema.validate(data, { abortEarly: false });
        if (error) {
            return {
                error: error.details.map(d => d.message).join('; ')
            };
        }
        return { value };
    }
    validateManualCorrection(data) {
        const { error, value } = this.manualCorrectionSchema.validate(data, { abortEarly: false });
        if (error) {
            return {
                error: error.details.map(d => d.message).join('; ')
            };
        }
        return { value };
    }
    validateStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            [types_1.RecalculationStatus.DRAFT]: [types_1.RecalculationStatus.PENDING_APPROVAL],
            [types_1.RecalculationStatus.PENDING_APPROVAL]: [types_1.RecalculationStatus.APPROVED, types_1.RecalculationStatus.REJECTED],
            [types_1.RecalculationStatus.APPROVED]: [types_1.RecalculationStatus.PROCESSING, types_1.RecalculationStatus.NEEDS_MANUAL_CORRECTION],
            [types_1.RecalculationStatus.PROCESSING]: [types_1.RecalculationStatus.COMPLETED, types_1.RecalculationStatus.FAILED, types_1.RecalculationStatus.NEEDS_MANUAL_CORRECTION],
            [types_1.RecalculationStatus.NEEDS_MANUAL_CORRECTION]: [types_1.RecalculationStatus.PENDING_APPROVAL],
            [types_1.RecalculationStatus.REJECTED]: [types_1.RecalculationStatus.PENDING_APPROVAL],
            [types_1.RecalculationStatus.FAILED]: [types_1.RecalculationStatus.PENDING_APPROVAL],
            [types_1.RecalculationStatus.COMPLETED]: []
        };
        return validTransitions[currentStatus]?.includes(newStatus) ?? false;
    }
}
exports.ValidationService = ValidationService;
