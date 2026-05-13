import { store } from '../store';
import { FirstArticleInspection, FirstArticleItem, InspectionStatus } from '../types';

export class FirstArticleService {
  createInspection(
    data: Omit<FirstArticleInspection, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    operator: string,
    operatorId: string,
    requestId: string
  ): FirstArticleInspection {
    const idempotent = store.checkIdempotent(requestId);
    if (idempotent.exists) {
      return idempotent.result;
    }

    const inspection: FirstArticleInspection = {
      id: store.generateId(),
      ...data,
      createdAt: store.now(),
      updatedAt: store.now(),
      version: 1
    };

    store.firstArticleInspections.set(inspection.id, inspection);
    store.addStatusHistory(inspection.id, 'FIRST_ARTICLE', inspection.status, undefined, operator, operatorId, '创建首件检验');
    store.markIdempotent(requestId, 'FIRST_ARTICLE', 'CREATE', inspection);

    return inspection;
  }

  updateInspectionItem(
    inspectionId: string,
    itemId: string,
    result: string,
    measuredValue: string,
    isPassed: boolean,
    checkedBy: string,
    checkedById: string
  ): FirstArticleInspection {
    const inspection = store.firstArticleInspections.get(inspectionId);
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
      measuredValue,
      isPassed,
      checkedBy,
      checkedAt: store.now()
    };

    const newItems = [...inspection.items];
    newItems[itemIndex] = newItem;

    const allChecked = newItems.every(i => i.isPassed !== undefined);
    const allPassed = newItems.every(i => i.isPassed === true);
    const hasFailed = newItems.some(i => i.isPassed === false);

    let newStatus: InspectionStatus = inspection.status;
    if (allChecked) {
      newStatus = allPassed ? 'PASSED' : 'FAILED';
    } else if (newItems.some(i => i.isPassed !== undefined)) {
      newStatus = 'IN_PROGRESS';
    }

    const updatedInspection: FirstArticleInspection = {
      ...inspection,
      items: newItems,
      status: newStatus,
      updatedAt: store.now(),
      version: inspection.version + 1
    };

    store.firstArticleInspections.set(inspectionId, updatedInspection);

    store.addChangeLog(inspectionId, 'FIRST_ARTICLE', `items.${itemId}`, oldItem, newItem, checkedBy, checkedById);

    if (newStatus !== inspection.status) {
      store.addStatusHistory(inspectionId, 'FIRST_ARTICLE', newStatus, inspection.status, checkedBy, checkedById, '检验项更新');
    }

    return updatedInspection;
  }

  reviewInspection(
    inspectionId: string,
    reviewedBy: string,
    reviewedById: string,
    remark?: string
  ): FirstArticleInspection {
    const inspection = store.firstArticleInspections.get(inspectionId);
    if (!inspection) {
      throw new Error('INSPECTION_NOT_FOUND');
    }

    if (inspection.status !== 'PASSED' && inspection.status !== 'FAILED') {
      throw new Error('INVALID_STATUS_FOR_REVIEW');
    }

    const updatedInspection: FirstArticleInspection = {
      ...inspection,
      status: 'REVIEWED',
      reviewedBy,
      reviewedAt: store.now(),
      updatedAt: store.now(),
      version: inspection.version + 1
    };

    store.firstArticleInspections.set(inspectionId, updatedInspection);
    store.addStatusHistory(inspectionId, 'FIRST_ARTICLE', 'REVIEWED', inspection.status, reviewedBy, reviewedById, remark || '复核完成');

    return updatedInspection;
  }

  getInspection(id: string): FirstArticleInspection | undefined {
    return store.firstArticleInspections.get(id);
  }

  getInspectionsByPlan(planId: string): FirstArticleInspection[] {
    return Array.from(store.firstArticleInspections.values())
      .filter(i => i.planId === planId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllInspections(): FirstArticleInspection[] {
    return Array.from(store.firstArticleInspections.values()).sort(
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
        REWORK: inspections.filter(i => i.status === 'REWORK').length,
        REVIEWED: inspections.filter(i => i.status === 'REVIEWED').length
      },
      passRate: inspections.length > 0
        ? Math.round((inspections.filter(i => i.status === 'PASSED' || i.status === 'REVIEWED').length / inspections.length) * 100)
        : 0
    };
  }
}

export const firstArticleService = new FirstArticleService();
