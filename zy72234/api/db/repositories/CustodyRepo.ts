import { getCustodyStore } from '../memoryStore.js';
import type { CustodyConfirmation } from '../../../shared/types.js';

export const CustodyRepo = {
  findAll(): CustodyConfirmation[] {
    const store = getCustodyStore();
    return Array.from(store.values()).sort((a, b) =>
      b.createTime.localeCompare(a.createTime)
    );
  },

  findById(id: string): CustodyConfirmation | undefined {
    const store = getCustodyStore();
    return store.get(id);
  },

  findByAdjustmentId(adjustmentId: string): CustodyConfirmation | undefined {
    return this.findAll().find(c => c.adjustmentId === adjustmentId);
  },

  create(custody: Omit<CustodyConfirmation, 'id'> & { id?: string }): CustodyConfirmation {
    const store = getCustodyStore();
    const id = custody.id || `cust_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newCustody = {
      ...custody,
      id,
      createTime: custody.createTime || now,
      updateTime: custody.updateTime || now,
    } as CustodyConfirmation;
    store.set(id, newCustody);
    return newCustody;
  },

  update(id: string, updates: Partial<Omit<CustodyConfirmation, 'id' | 'adjustmentId' | 'createTime'>>): void {
    const store = getCustodyStore();
    const custody = store.get(id);
    if (custody) {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      store.set(id, {
        ...custody,
        ...updates,
        updateTime: updates.updateTime || now,
      });
    }
  },
};
