import { AppDataSource } from '../data-source';
import { FailedRecord } from '../entities/FailedRecord';
import { Franchise } from '../entities/Franchise';
import { Material } from '../entities/Material';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DataValidationContext {
  sourceType: string;
  sourceNo?: string;
  data: any;
  originalData?: any;
}

export class ValidationService {
  private failedRecordRepository = AppDataSource.getRepository(FailedRecord);
  private franchiseRepository = AppDataSource.getRepository(Franchise);
  private materialRepository = AppDataSource.getRepository(Material);

  async validateOrderData(data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.orderNo) {
      errors.push('订单号不能为空');
    }

    if (!data.franchiseId) {
      errors.push('加盟商ID不能为空');
    } else {
      const franchise = await this.franchiseRepository.findOne({
        where: { id: data.franchiseId }
      });
      if (!franchise) {
        errors.push(`加盟商不存在: ${data.franchiseId}`);
      }
    }

    if (!data.orderDate) {
      errors.push('订单日期不能为空');
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('订单明细不能为空');
    } else {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        if (!item.materialId) {
          errors.push(`第${i + 1}行物料ID不能为空`);
        } else {
          const material = await this.materialRepository.findOne({
            where: { id: item.materialId }
          });
          if (!material) {
            errors.push(`第${i + 1}行物料不存在: ${item.materialId}`);
          }
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`第${i + 1}行数量必须大于0`);
        }
        if (!item.unitPrice || item.unitPrice < 0) {
          errors.push(`第${i + 1}行单价不能为负数`);
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async validateLossRecordData(data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.recordNo) {
      errors.push('损耗记录号不能为空');
    }

    if (!data.franchiseId) {
      errors.push('加盟商ID不能为空');
    }

    if (!data.materialId) {
      errors.push('物料ID不能为空');
    }

    if (!data.lossDate) {
      errors.push('损耗日期不能为空');
    }

    if (!data.quantity || data.quantity <= 0) {
      errors.push('损耗数量必须大于0');
    }

    if (!data.lossAmount || data.lossAmount <= 0) {
      errors.push('损耗金额必须大于0');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async validateReceiptData(data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.receiptNo) {
      errors.push('回执单号不能为空');
    }

    if (!data.franchiseId) {
      errors.push('加盟商ID不能为空');
    }

    if (!data.sourceType) {
      errors.push('来源类型不能为空');
    }

    if (data.quantity !== undefined && data.quantity < 0) {
      warnings.push('数量为负数，请确认是否正确');
    }

    if (data.amount !== undefined && data.amount < 0) {
      warnings.push('金额为负数，请确认是否正确');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async recordFailure(context: DataValidationContext, errors: string[]): Promise<FailedRecord> {
    const failedRecord = this.failedRecordRepository.create({
      sourceType: context.sourceType,
      sourceNo: context.sourceNo,
      originalData: context.originalData || context.data,
      errorReason: errors.join('; '),
      errorCode: 'VALIDATION_ERROR',
      isResolved: false
    });

    return this.failedRecordRepository.save(failedRecord);
  }

  async getFailedRecords(sourceType?: string, isResolved?: boolean): Promise<FailedRecord[]> {
    const where: any = {};
    if (sourceType) where.sourceType = sourceType;
    if (isResolved !== undefined) where.isResolved = isResolved;

    return this.failedRecordRepository.find({
      where,
      order: { createdAt: 'DESC' }
    });
  }

  async resolveFailedRecord(id: string, remark: string): Promise<boolean> {
    const result = await this.failedRecordRepository.update(id, {
      isResolved: true,
      resolveRemark: remark,
      resolvedAt: new Date()
    });

    return result.affected !== undefined && result.affected > 0;
  }
}

export const validationService = new ValidationService();
