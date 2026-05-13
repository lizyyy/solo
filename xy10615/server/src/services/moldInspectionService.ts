import { store } from '../store';
import { MoldInspection, MoldInspectionItem, CheckStatus } from '../types';

export class MoldInspectionService {
  createInspection(
    data: Omit<MoldInspection, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    operator: string,
    operatorId: string,
    requestId: string
  ): MoldInspection {
    const idempotent = store.checkIdempotent(requestId);
    if (idempotent.exists) {
      return idempotent.result;
    }

    const inspection: MoldInspection = {
      id: store.generateId(),
      ...data,
      createdAt: store.now(),
      updatedAt: store.now(),
      version: 1
    };

    store.moldInspections.set(inspection.id, inspection);
    store.addStatusHistory(inspection.id, 'MOLD_INSPECTION', inspection.status, undefined, operator, operatorId, '创建模具点检');
    store.markIdempotent(requestId, 'MOLD_INSPECTION', 'CREATE', inspection);

    return inspection;
  }

  updateInspectionItem(
    inspectionId: string,
    itemId: string,
    result: string,
    isPassed: boolean,
    checkedBy: string,
    checkedById: string
  ): MoldInspection {
    const inspection = store.moldInspections.get(inspectionId);
    if (!inspection) {
      throw new Error('INSPECTION_NOT_FOUND');
    }

    const itemIndex = inspection.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      throw new Error('ITEM_NOT_FOUND');
    }

    const oldItem = { ...inspection.items[itemIndex] };
    const newItem = {
      ...inspection.items[itemIndex],
      result,
      isPassed,
      checkedBy,
      checkedAt: store.now()
    };

    const newItems = [...inspection.items];
    newItems[itemIndex] = newItem;

    const allChecked = newItems.every(i => i.isPassed !== undefined);
    const allPassed = newItems.every(i => i.isPassed === true);
    const hasFailed = newItems.some(i => i.isPassed === false);

    let newStatus: CheckStatus = inspection.status;
    if (allChecked) {
      newStatus = allPassed ? 'PASSED' : 'FAILED';
    } else if (newItems.some(i => i.isPassed !== undefined)) {
      newStatus = 'IN_PROGRESS';
    }

    const updatedInspection: MoldInspection = {
      ...inspection,
      items: newItems,
      status: newStatus,
      updatedAt: store.now(),
      version: inspection.version + 1
    };

    store.moldInspections.set(inspectionId, updatedInspection);

    store.addChangeLog(inspectionId, 'MOLD_INSPECTION', `items.${itemId}`, oldItem, newItem, checkedBy, checkedById);

    if (newStatus !== inspection.status) {
      store.addStatusHistory(inspectionId, 'MOLD_INSPECTION', newStatus, inspection.status, checkedBy, checkedById, '点检项更新');
    }

    return updatedInspection;
  }

  reviewInspection(
    inspectionId: string,
    reviewedBy: string,
    reviewedById: string,
    remark?: string
  ): MoldInspection {
    const inspection = store.moldInspections.get(inspectionId);
    if (!inspection) {
      throw new Error('INSPECTION_NOT_FOUND');
    }

    if (inspection.status !== 'PASSED' && inspection.status !== 'FAILED') {
      throw new Error('INVALID_STATUS_FOR_REVIEW');
    }

    const updatedInspection: MoldInspection = {
      ...inspection,
      status: 'REVIEWED',
      reviewedBy,
      reviewedAt: store.now(),
      updatedAt: store.now(),
      version: inspection.version + 1
    };

    store.moldInspections.set(inspectionId, updatedInspection);
    store.addStatusHistory(inspectionId, 'MOLD_INSPECTION', 'REVIEWED', inspection.status, reviewedBy, reviewedById, remark || '复核完成');

    return updatedInspection;
  }

  validateInspection(inspectionId: string): { valid: boolean; errors: string[] } {
    const inspection = store.moldInspections.get(inspectionId);
    if (!inspection) {
      return { valid: false, errors: ['点检记录不存在'] };
    }

    const errors: string[] = [];

    inspection.items.forEach((item, index) => {
      if (!item.result) {
        errors.push(`第${index + 1}项"${item.name}"未填写结果`);
      }
      if (item.isPassed === undefined) {
        errors.push(`第${index + 1}项"${item.name}"未判定是否通过`);
      }
      if (!item.checkedBy) {
        errors.push(`第${index + 1}项"${item.name}"未记录检验人`);
      }
    });

    const hasFailed = inspection.items.some(i => i.isPassed === false);
    if (hasFailed && inspection.status === 'PASSED') {
      errors.push('存在未通过的点检项，但状态标记为通过，数据不一致');
    }

    return { valid: errors.length === 0, errors };
  }

  getInspection(id: string): MoldInspection | undefined {
    return store.moldInspections.get(id);
  }

  getInspectionsByPlan(planId: string): MoldInspection[] {
    return Array.from(store.moldInspections.values())
      .filter(i => i.planId === planId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllInspections(): MoldInspection[] {
    return Array.from(store.moldInspections.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getStatistics() {
    const inspections = this.getAllInspections();
    return {
      total: inspections.length,
      byStatus: {
        NOT_STARTED: inspections.filter(i => i.status === 'NOT_STARTED').length,
        IN_PROGRESS: inspections.filter(i => i.status === 'IN_PROGRESS').length,
        PASSED: inspections.filter(i => i.status === 'PASSED').length,
        FAILED: inspections.filter(i => i.status === 'FAILED').length,
        REVIEWED: inspections.filter(i => i.status === 'REVIEWED').length
      },
      pendingReview: inspections.filter(i => i.status === 'PASSED' || i.status === 'FAILED').length
    };
  }
}

export const moldInspectionService = new MoldInspectionService();
