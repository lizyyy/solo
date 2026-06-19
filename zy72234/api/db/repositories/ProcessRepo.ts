import { getProcessNodesStore } from '../memoryStore.js';
import type { ProcessNode } from '../../../shared/types.js';

export const ProcessRepo = {
  findAll(): ProcessNode[] {
    const store = getProcessNodesStore();
    return Array.from(store.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
  },

  findByAdjustmentId(adjustmentId: string): ProcessNode[] {
    const store = getProcessNodesStore();
    return Array.from(store.values())
      .filter(n => n.adjustmentId === adjustmentId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  },

  create(node: Omit<ProcessNode, 'id'> & { id?: string }): ProcessNode {
    const store = getProcessNodesStore();
    const id = node.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newNode = { ...node, id } as ProcessNode;
    store.set(id, newNode);
    return newNode;
  },

  deleteByAdjustmentId(adjustmentId: string): void {
    const store = getProcessNodesStore();
    for (const [key, node] of store.entries()) {
      if (node.adjustmentId === adjustmentId) {
        store.delete(key);
      }
    }
  },
};
