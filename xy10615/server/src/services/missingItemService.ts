import { store } from '../store';
import { MissingItem } from '../types';

export class MissingItemService {
  addMissingItem(
    data: Omit<MissingItem, 'id' | 'createdAt'>,
    requestId: string
  ): MissingItem {
    const idempotent = store.checkIdempotent(requestId);
    if (idempotent.exists) {
      return idempotent.result;
    }

    const missingItem: MissingItem = {
      id: store.generateId(),
      ...data,
      createdAt: store.now()
    };

    store.missingItems.set(missingItem.id, missingItem);
    store.markIdempotent(requestId, 'MISSING_ITEM', 'CREATE', missingItem);

    return missingItem;
  }

  updateMissingItem(
    id: string,
    updates: Partial<MissingItem>,
    operator: string,
    operatorId: string
  ): MissingItem {
    const item = store.missingItems.get(id);
    if (!item) {
      throw new Error('ITEM_NOT_FOUND');
    }

    const oldStatus = item.status;
    const updatedItem = {
      ...item,
      ...updates,
      resolvedAt: updates.status === 'RESOLVED' && oldStatus !== 'RESOLVED' ? store.now() : item.resolvedAt
    };

    store.missingItems.set(id, updatedItem);

    if (updates.status && updates.status !== oldStatus) {
      store.addStatusHistory(id, 'MISSING_ITEM', updates.status, oldStatus, operator, operatorId, '缺项状态变更');
    }

    return updatedItem;
  }

  getMissingItem(id: string): MissingItem | undefined {
    return store.missingItems.get(id);
  }

  getMissingItemsByPlan(planId: string): MissingItem[] {
    return Array.from(store.missingItems.values())
      .filter(item => item.planId === planId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getMissingItemsByCategory(category: MissingItem['category']): MissingItem[] {
    return Array.from(store.missingItems.values())
      .filter(item => item.category === category);
  }

  getMissingItemsByStatus(status: MissingItem['status']): MissingItem[] {
    return Array.from(store.missingItems.values())
      .filter(item => item.status === status);
  }

  getAllMissingItems(): MissingItem[] {
    return Array.from(store.missingItems.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getStatistics() {
    const items = this.getAllMissingItems();
    return {
      total: items.length,
      byCategory: {
        MOLD: items.filter(i => i.category === 'MOLD').length,
        MATERIAL: items.filter(i => i.category === 'MATERIAL').length,
        TOOL: items.filter(i => i.category === 'TOOL').length,
        DOCUMENT: items.filter(i => i.category === 'DOCUMENT').length,
        OTHER: items.filter(i => i.category === 'OTHER').length
      },
      byStatus: {
        OPEN: items.filter(i => i.status === 'OPEN').length,
        IN_PROGRESS: items.filter(i => i.status === 'IN_PROGRESS').length,
        RESOLVED: items.filter(i => i.status === 'RESOLVED').length,
        CLOSED: items.filter(i => i.status === 'CLOSED').length
      },
      overdue: items.filter(i => {
        if (i.status === 'RESOLVED' || i.status === 'CLOSED') return false;
        return new Date(i.dueDate) < new Date();
      }).length
    };
  }
}

export const missingItemService = new MissingItemService();
