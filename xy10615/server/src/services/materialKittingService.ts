import { store } from '../store';
import { MaterialKitting, MaterialItem, KittingStatus } from '../types';

export class MaterialKittingService {
  createKitting(
    data: Omit<MaterialKitting, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    operator: string,
    operatorId: string,
    requestId: string
  ): MaterialKitting {
    const idempotent = store.checkIdempotent(requestId);
    if (idempotent.exists) {
      return idempotent.result;
    }

    const kitting: MaterialKitting = {
      id: store.generateId(),
      ...data,
      createdAt: store.now(),
      updatedAt: store.now(),
      version: 1
    };

    store.materialKittings.set(kitting.id, kitting);
    store.addStatusHistory(kitting.id, 'MATERIAL_KITTING', kitting.status, undefined, operator, operatorId, '创建物料齐套');
    store.markIdempotent(requestId, 'MATERIAL_KITTING', 'CREATE', kitting);

    return kitting;
  }

  updateMaterialItem(
    kittingId: string,
    itemId: string,
    actualQty: number,
    checkedBy: string,
    checkedById: string
  ): MaterialKitting {
    const kitting = store.materialKittings.get(kittingId);
    if (!kitting) {
      throw new Error('KITTING_NOT_FOUND');
    }

    const itemIndex = kitting.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      throw new Error('ITEM_NOT_FOUND');
    }

    const oldItem = { ...kitting.items[itemIndex] };
    
    let itemStatus: KittingStatus = 'NOT_STARTED';
    if (actualQty >= kitting.items[itemIndex].requiredQty) {
      itemStatus = 'COMPLETE';
    } else if (actualQty > 0) {
      itemStatus = 'PARTIAL';
    } else {
      itemStatus = 'MISSING';
    }

    const newItem = {
      ...kitting.items[itemIndex],
      actualQty,
      status: itemStatus,
      checkedBy,
      checkedAt: store.now()
    };

    const newItems = [...kitting.items];
    newItems[itemIndex] = newItem;

    const allChecked = newItems.every(i => i.status !== 'NOT_STARTED');
    const allComplete = newItems.every(i => i.status === 'COMPLETE');
    const hasMissing = newItems.some(i => i.status === 'MISSING');

    let newStatus: KittingStatus = kitting.status;
    if (allChecked) {
      if (allComplete) {
        newStatus = 'COMPLETE';
      } else if (hasMissing) {
        newStatus = 'MISSING';
      } else {
        newStatus = 'PARTIAL';
      }
    } else if (newItems.some(i => i.status !== 'NOT_STARTED')) {
      newStatus = 'IN_PROGRESS';
    }

    const updatedKitting: MaterialKitting = {
      ...kitting,
      items: newItems,
      status: newStatus,
      updatedAt: store.now(),
      version: kitting.version + 1
    };

    store.materialKittings.set(kittingId, updatedKitting);

    if (oldItem.actualQty !== newItem.actualQty) {
      store.addChangeLog(kittingId, 'MATERIAL_KITTING', `items.${itemId}.actualQty`, oldItem.actualQty, newItem.actualQty, checkedBy, checkedById);
    }
    if (oldItem.status !== newItem.status) {
      store.addChangeLog(kittingId, 'MATERIAL_KITTING', `items.${itemId}.status`, oldItem.status, newItem.status, checkedBy, checkedById);
    }

    if (newStatus !== kitting.status) {
      store.addStatusHistory(kittingId, 'MATERIAL_KITTING', newStatus, kitting.status, checkedBy, checkedById, '物料齐套更新');
    }

    return updatedKitting;
  }

  reviewKitting(
    kittingId: string,
    reviewedBy: string,
    reviewedById: string,
    remark?: string
  ): MaterialKitting {
    const kitting = store.materialKittings.get(kittingId);
    if (!kitting) {
      throw new Error('KITTING_NOT_FOUND');
    }

    const updatedKitting: MaterialKitting = {
      ...kitting,
      reviewedBy,
      reviewedAt: store.now(),
      updatedAt: store.now(),
      version: kitting.version + 1
    };

    store.materialKittings.set(kittingId, updatedKitting);
    store.addStatusHistory(kittingId, 'MATERIAL_KITTING', kitting.status, kitting.status, reviewedBy, reviewedById, remark || '复核完成');

    return updatedKitting;
  }

  getKitting(id: string): MaterialKitting | undefined {
    return store.materialKittings.get(id);
  }

  getKittingsByPlan(planId: string): MaterialKitting[] {
    return Array.from(store.materialKittings.values())
      .filter(k => k.planId === planId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllKittings(): MaterialKitting[] {
    return Array.from(store.materialKittings.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getStatistics() {
    const kittings = this.getAllKittings();
    return {
      total: kittings.length,
      byStatus: {
        NOT_STARTED: kittings.filter(k => k.status === 'NOT_STARTED').length,
        IN_PROGRESS: kittings.filter(k => k.status === 'IN_PROGRESS').length,
        PARTIAL: kittings.filter(k => k.status === 'PARTIAL').length,
        COMPLETE: kittings.filter(k => k.status === 'COMPLETE').length,
        MISSING: kittings.filter(k => k.status === 'MISSING').length
      },
      completeRate: kittings.length > 0 
        ? Math.round((kittings.filter(k => k.status === 'COMPLETE').length / kittings.length) * 100) 
        : 0
    };
  }
}

export const materialKittingService = new MaterialKittingService();
