import { v4 as uuidv4 } from 'uuid';
import SensitiveField from '../models/SensitiveField';
import ExceptionService from './ExceptionService';

interface CreateSensitiveFieldDTO {
  fieldName: string;
  dataType: string;
  sensitivityLevel: 'low' | 'medium' | 'high';
  maskingRule: string;
  description?: string;
}

class SensitiveFieldService {
  async getAllSensitiveFields(): Promise<SensitiveField[]> {
    return SensitiveField.findAll({
      order: [['sensitivityLevel', 'DESC']],
    });
  }

  async createSensitiveField(dto: CreateSensitiveFieldDTO): Promise<SensitiveField> {
    const existing = await SensitiveField.findOne({
      where: { fieldName: dto.fieldName },
    });

    if (existing) {
      await ExceptionService.recordException(
        'repeated_operation',
        `尝试重复创建敏感字段：${dto.fieldName}`,
        undefined,
        { fieldName: dto.fieldName }
      );
      throw new Error(`敏感字段 ${dto.fieldName} 已存在，请勿重复创建`);
    }

    const field = await SensitiveField.create({
      id: uuidv4(),
      ...dto,
    });

    return field;
  }

  async getSensitiveFieldsByNames(fieldNames: string[]): Promise<SensitiveField[]> {
    return SensitiveField.findAll({
      where: { fieldName: fieldNames },
    });
  }

  async validateFieldsForExport(fieldsToExport: string[]): Promise<{
    valid: boolean;
    message: string;
    highRiskFields: string[];
  }> {
    const sensitiveFields = await this.getSensitiveFieldsByNames(fieldsToExport);
    const highRiskFields = sensitiveFields
      .filter((f) => f.sensitivityLevel === 'high')
      .map((f) => f.fieldName);

    if (highRiskFields.length > 0) {
      await ExceptionService.recordException(
        'sensitive_field_violation',
        `导出申请包含高风险敏感字段：${highRiskFields.join(', ')}`,
        undefined,
        { fields: highRiskFields }
      );

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

  async getMaskingRuleForField(fieldName: string): Promise<string | null> {
    const field = await SensitiveField.findOne({
      where: { fieldName },
    });
    return field ? field.maskingRule : null;
  }
}

export default new SensitiveFieldService();
