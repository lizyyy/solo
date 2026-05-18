import { CreateApplicationRequest, ValidationResult, ApplicationStatus, RejectionReason } from '../types';

export class ValidationService {
  validateApplication(request: CreateApplicationRequest): ValidationResult {
    const timeValidation = this.validatePreparationTime(request);
    if (!timeValidation.valid) {
      return timeValidation;
    }

    const consistencyValidation = this.validateReplacementConsistency(request);
    if (!consistencyValidation.valid) {
      return consistencyValidation;
    }

    return { valid: true };
  }

  private validatePreparationTime(request: CreateApplicationRequest): ValidationResult {
    const now = new Date();
    const cutoffTime = new Date(request.mealPreparationCutoffTime);

    if (now > cutoffTime) {
      const timeDiff = Math.floor((now.getTime() - cutoffTime.getTime()) / (1000 * 60));
      return {
        valid: false,
        status: ApplicationStatus.REJECTED,
        rejectionReason: RejectionReason.TOO_LATE,
        message: `忌口变更申请已超过备餐截止时间。备餐截止时间为 ${cutoffTime.toLocaleString('zh-CN')}，当前时间已超过 ${timeDiff} 分钟。请联系配送组进行人工处理或申请次日替换。`
      };
    }

    const timeUntilCutoff = Math.floor((cutoffTime.getTime() - now.getTime()) / (1000 * 60));
    if (timeUntilCutoff < 60) {
      return {
        valid: false,
        status: ApplicationStatus.PROCESSING,
        rejectionReason: RejectionReason.TOO_LATE,
        message: `距离备餐截止时间不足 ${timeUntilCutoff} 分钟，申请已进入待人工审核状态。请立即联系配送组确认是否可加急处理。`
      };
    }

    return { valid: true };
  }

  private validateReplacementConsistency(request: CreateApplicationRequest): ValidationResult {
    const restrictionIds = request.dietaryRestrictions.map(r => r.name);
    
    for (const item of request.replacementItems) {
      const matchedRestriction = request.dietaryRestrictions.find(
        r => item.reason.includes(r.name)
      );

      if (!matchedRestriction) {
        return {
          valid: false,
          status: ApplicationStatus.REJECTED,
          rejectionReason: RejectionReason.INCONSISTENT,
          message: `替换菜品"${item.originalMealName}"的替换原因与申请的忌口清单不一致。请检查：替换原因必须明确对应已申报的忌口项（${restrictionIds.join('、')}）。`
        };
      }
    }

    const mealIds = request.replacementItems.map(item => item.originalMealId);
    const duplicateMeals = mealIds.filter((id, index) => mealIds.indexOf(id) !== index);
    if (duplicateMeals.length > 0) {
      const duplicateNames = request.replacementItems
        .filter(item => duplicateMeals.includes(item.originalMealId))
        .map(item => item.originalMealName);
      return {
        valid: false,
        status: ApplicationStatus.REJECTED,
        rejectionReason: RejectionReason.INCONSISTENT,
        message: `替换清单存在重复菜品：${[...new Set(duplicateNames)].join('、')}。每个菜品只能申请一次替换，请合并相同菜品的替换理由后重新提交。`
      };
    }

    return { valid: true };
  }
}

export const validationService = new ValidationService();
