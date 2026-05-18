import { StoreInspection, ValidationError, ValidationResult } from './types';

export class InspectionValidator {
  private isDateOverdue(dateStr: string): boolean {
    const deadline = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deadline < today;
  }

  private checkPhotoReuse(inspection: StoreInspection): ValidationError[] {
    const errors: ValidationError[] = [];
    const hashMap = new Map<string, string[]>();

    inspection.photos.forEach(photo => {
      const existing = hashMap.get(photo.md5Hash) || [];
      existing.push(photo.photoId);
      hashMap.set(photo.md5Hash, existing);
    });

    hashMap.forEach((photoIds, hash) => {
      if (photoIds.length > 1) {
        errors.push({
          type: 'photo_reuse',
          severity: 'high',
          storeId: inspection.storeId,
          storeName: inspection.storeName,
          message: `发现照片复用: MD5 ${hash} 被 ${photoIds.length} 张照片使用 (${photoIds.join(', ')})`,
          suggestion: '请核实每张照片是否对应不同的检查项，确保每个问题点都有独立的现场照片，禁止使用历史照片或同一张照片多次提交',
          relatedData: { hash, photoIds, count: photoIds.length }
        });
      }
    });

    inspection.items.forEach(item => {
      if (item.rectificationPhotoId) {
        const photo = inspection.photos.find(p => p.photoId === item.rectificationPhotoId);
        if (photo) {
          const otherItems = inspection.items.filter(
            i => i.itemId !== item.itemId && i.rectificationPhotoId === item.rectificationPhotoId
          );
          if (otherItems.length > 0) {
            errors.push({
              type: 'photo_reuse',
              severity: 'high',
              storeId: inspection.storeId,
              storeName: inspection.storeName,
              itemId: item.itemId,
              message: `整改照片复用: 照片 ${item.rectificationPhotoId} 同时用于 ${otherItems.length + 1} 个检查项`,
              suggestion: '每个需要整改的项目都应上传独立的整改后照片，不能用同一张照片覆盖多个整改项',
              relatedData: { photoId: item.rectificationPhotoId, affectedItems: [item.itemId, ...otherItems.map(i => i.itemId)] }
            });
          }
        }
      }
    });

    return errors;
  }

  private checkOverdueRectification(inspection: StoreInspection): ValidationError[] {
    const errors: ValidationError[] = [];

    inspection.items.forEach(item => {
      if (item.rectificationRequired && item.rectificationDeadline) {
        const isOverdue = this.isDateOverdue(item.rectificationDeadline);
        const status = item.rectificationStatus;

        if (isOverdue && status !== 'completed') {
          errors.push({
            type: 'overdue_rectification',
            severity: 'high',
            storeId: inspection.storeId,
            storeName: inspection.storeName,
            itemId: item.itemId,
            message: `整改逾期: 检查项 ${item.itemId}(${item.description}) 整改截止日期 ${item.rectificationDeadline} 已过，当前状态: ${status || '未设置'}`,
            suggestion: '立即跟进门店整改进度，督促完成整改并上传整改照片，更新整改状态为已完成，必要时追加处罚',
            relatedData: { 
              itemId: item.itemId, 
              deadline: item.rectificationDeadline,
              status: status,
              category: item.category
            }
          });
        } else if (!isOverdue && status === 'overdue') {
          errors.push({
            type: 'overdue_rectification',
            severity: 'medium',
            storeId: inspection.storeId,
            storeName: inspection.storeName,
            itemId: item.itemId,
            message: `状态异常: 检查项 ${item.itemId} 标记为逾期，但截止日期 ${item.rectificationDeadline} 尚未到`,
            suggestion: '核实截止日期设置是否正确，如状态有误请更新为正确状态',
            relatedData: { itemId: item.itemId, deadline: item.rectificationDeadline }
          });
        }
      }
    });

    return errors;
  }

  private checkInvalidData(inspection: StoreInspection): ValidationError[] {
    const errors: ValidationError[] = [];

    inspection.items.forEach(item => {
      if (item.score < 0 || item.score > item.maxScore) {
        errors.push({
          type: 'invalid_data',
          severity: 'medium',
          storeId: inspection.storeId,
          storeName: inspection.storeName,
          itemId: item.itemId,
          message: `分数异常: 检查项 ${item.itemId} 得分为 ${item.score}，超出有效范围 [0, ${item.maxScore}]`,
          suggestion: '重新核实该项目的扣分标准和实际得分，确保在有效范围内',
          relatedData: { score: item.score, maxScore: item.maxScore }
        });
      }

      if (item.rectificationRequired && !item.rectificationDeadline) {
        errors.push({
          type: 'invalid_data',
          severity: 'low',
          storeId: inspection.storeId,
          storeName: inspection.storeName,
          itemId: item.itemId,
          message: `数据不全: 检查项 ${item.itemId} 需要整改，但未设置整改截止日期`,
          suggestion: '补充设置整改截止日期，一般建议为检查后7-15天内',
          relatedData: { itemId: item.itemId }
        });
      }
    });

    inspection.items.forEach(item => {
      if (item.rectificationPhotoId) {
        const photoExists = inspection.photos.some(p => p.photoId === item.rectificationPhotoId);
        if (!photoExists) {
          errors.push({
            type: 'invalid_data',
            severity: 'medium',
            storeId: inspection.storeId,
            storeName: inspection.storeName,
            itemId: item.itemId,
            message: `照片缺失: 检查项 ${item.itemId} 引用的整改照片 ${item.rectificationPhotoId} 不存在`,
            suggestion: '上传整改照片并正确关联 photoId，或检查引用的 photoId 是否正确',
            relatedData: { missingPhotoId: item.rectificationPhotoId }
          });
        }
      }
    });

    return errors;
  }

  validate(inspections: StoreInspection[]): ValidationResult {
    const allErrors: ValidationError[] = [];

    inspections.forEach(inspection => {
      allErrors.push(...this.checkPhotoReuse(inspection));
      allErrors.push(...this.checkOverdueRectification(inspection));
      allErrors.push(...this.checkInvalidData(inspection));
    });

    allErrors.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      if (a.storeId !== b.storeId) {
        return a.storeId.localeCompare(b.storeId);
      }
      return (a.itemId || '').localeCompare(b.itemId || '');
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      summary: {
        totalErrors: allErrors.length,
        photoReuseCount: allErrors.filter(e => e.type === 'photo_reuse').length,
        overdueCount: allErrors.filter(e => e.type === 'overdue_rectification').length,
        invalidDataCount: allErrors.filter(e => e.type === 'invalid_data').length
      }
    };
  }
}
