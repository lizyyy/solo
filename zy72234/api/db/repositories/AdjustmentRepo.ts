import { getAdjustmentsStore } from '../memoryStore.js';
import type { TailAdjustment, AdjustmentStatus } from '../../../shared/types.js';

export const AdjustmentRepo = {
  findAll(): TailAdjustment[] {
    const store = getAdjustmentsStore();
    return Array.from(store.values()).sort((a, b) => {
      if (a.tradeDate !== b.tradeDate) {
        return b.tradeDate.localeCompare(a.tradeDate);
      }
      return b.importTime.localeCompare(a.importTime);
    });
  },

  findById(id: string): TailAdjustment | undefined {
    const store = getAdjustmentsStore();
    return store.get(id);
  },

  findByStatus(status: AdjustmentStatus): TailAdjustment[] {
    return this.findAll().filter(adj => adj.status === status);
  },

  findFlagged(): TailAdjustment[] {
    return this.findAll().filter(adj => adj.hasZeroAmountButReversed);
  },

  create(adjustment: Omit<TailAdjustment, 'id'> & { id?: string }): TailAdjustment {
    const store = getAdjustmentsStore();
    const id = adjustment.id || `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newAdj = { ...adjustment, id } as TailAdjustment;
    store.set(id, newAdj);
    return newAdj;
  },

  updateStatus(id: string, status: AdjustmentStatus, reviewTime?: string, reviewOperator?: string, reviewComment?: string): void {
    const store = getAdjustmentsStore();
    const adj = store.get(id);
    if (adj) {
      store.set(id, {
        ...adj,
        status,
        reviewTime: reviewTime || adj.reviewTime,
        reviewOperator: reviewOperator || adj.reviewOperator,
        reviewComment: reviewComment || adj.reviewComment,
      });
    }
  },

  updateCustodyConfirmId(id: string, custodyConfirmId: string): void {
    const store = getAdjustmentsStore();
    const adj = store.get(id);
    if (adj) {
      store.set(id, {
        ...adj,
        custodyConfirmId,
        status: 'pending_review',
      });
    }
  },

  getStats(): { total: number; pendingCustody: number; pendingReview: number; completed: number; flagged: number } {
    const all = this.findAll();
    return {
      total: all.length,
      pendingCustody: all.filter(a => a.status === 'pending_custody').length,
      pendingReview: all.filter(a => a.status === 'pending_review').length,
      completed: all.filter(a => a.status === 'reviewed_normal' || a.status === 'needs_verification').length,
      flagged: all.filter(a => a.hasZeroAmountButReversed).length,
    };
  },

  getDateRangeData(startDate: string, endDate: string): TailAdjustment[] {
    return this.findAll()
      .filter(adj => adj.tradeDate >= startDate && adj.tradeDate <= endDate)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  },
};
