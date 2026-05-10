"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const SensitiveField_1 = __importDefault(require("../models/SensitiveField"));
const ExceptionService_1 = __importDefault(require("./ExceptionService"));
class SensitiveFieldService {
    async getAllSensitiveFields() {
        return SensitiveField_1.default.findAll({
            order: [['sensitivityLevel', 'DESC']],
        });
    }
    async createSensitiveField(dto) {
        const existing = await SensitiveField_1.default.findOne({
            where: { fieldName: dto.fieldName },
        });
        if (existing) {
            await ExceptionService_1.default.recordException('repeated_operation', `尝试重复创建敏感字段：${dto.fieldName}`, undefined, { fieldName: dto.fieldName });
            throw new Error(`敏感字段 ${dto.fieldName} 已存在，请勿重复创建`);
        }
        const field = await SensitiveField_1.default.create({
            id: (0, uuid_1.v4)(),
            ...dto,
        });
        return field;
    }
    async getSensitiveFieldsByNames(fieldNames) {
        return SensitiveField_1.default.findAll({
            where: { fieldName: fieldNames },
        });
    }
    async validateFieldsForExport(fieldsToExport) {
        const sensitiveFields = await this.getSensitiveFieldsByNames(fieldsToExport);
        const highRiskFields = sensitiveFields
            .filter((f) => f.sensitivityLevel === 'high')
            .map((f) => f.fieldName);
        if (highRiskFields.length > 0) {
            await ExceptionService_1.default.recordException('sensitive_field_violation', `导出申请包含高风险敏感字段：${highRiskFields.join(', ')}`, undefined, { fields: highRiskFields });
            return {
                valid: false,
                message: `导出包含 ${highRiskFields.length} 个高风险敏感字段（${highRiskFields.join('、')}），需要特别审批`,
                highRiskFields,
            };
        }
        return {
            valid: true,
            message: '导出字段检查通过',
            highRiskFields: [],
        };
    }
    async getMaskingRuleForField(fieldName) {
        const field = await SensitiveField_1.default.findOne({
            where: { fieldName },
        });
        return field ? field.maskingRule : null;
    }
}
exports.default = new SensitiveFieldService();
