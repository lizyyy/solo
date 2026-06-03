import type { TailAdjustment, CustodyConfirmation, ProcessNode } from '../../shared/types.js';
import { mockAdjustments, mockCustodyConfirmations, mockProcessNodes } from '../../shared/mockData.js';

interface DataStore {
  adjustments: Map<string, TailAdjustment>;
  custodyConfirmations: Map<string, CustodyConfirmation>;
  processNodes: Map<string, ProcessNode>;
}

let store: DataStore;

export function initMemoryStore(): void {
  store = {
    adjustments: new Map(),
    custodyConfirmations: new Map(),
    processNodes: new Map(),
  };

  for (const adj of mockAdjustments) {
    store.adjustments.set(adj.id, { ...adj });
  }

  for (const custody of mockCustodyConfirmations) {
    store.custodyConfirmations.set(custody.id, { ...custody });
  }

  for (const node of mockProcessNodes) {
    store.processNodes.set(node.id, { ...node });
  }

  console.log('[MemoryStore] Initialized with', store.adjustments.size, 'adjustments,',
    store.custodyConfirmations.size, 'custody records,',
    store.processNodes.size, 'process nodes');
}

export function getAdjustmentsStore(): Map<string, TailAdjustment> {
  return store.adjustments;
}

export function getCustodyStore(): Map<string, CustodyConfirmation> {
  return store.custodyConfirmations;
}

export function getProcessNodesStore(): Map<string, ProcessNode> {
  return store.processNodes;
}
