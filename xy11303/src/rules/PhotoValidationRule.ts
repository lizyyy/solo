import { PhotoModel } from '../models/PhotoModel';
import { ValidationResult } from '../types';
import dayjs from 'dayjs';

export interface PhotoValidationContext {
  taskId: string;
  requiredPhotos: number;
  submittedPhotos?: number;
}

export class PhotoValidationRule {
  static async validate(context: PhotoValidationContext): Promise<ValidationResult> {
    const photoCount = context.submittedPhotos ?? PhotoModel.countByTaskId(context.taskId);
    
    if (photoCount < context.requiredPhotos) {
      return {
        valid: false,
        passed: false,
        reason: `照片数量不足，要求${context.requiredPhotos}张，实际${photoCount}张，缺少${context.requiredPhotos - photoCount}张`,
        rule: 'MISSING_PHOTOS',
        severity: 'error',
        deductionAmount: Math.min((context.requiredPhotos - photoCount) * 20, 100)
      };
    }

    return {
      valid: true,
      passed: true,
      reason: '照片数量符合要求',
      rule: 'MISSING_PHOTOS',
      severity: 'info'
    };
  }
}
