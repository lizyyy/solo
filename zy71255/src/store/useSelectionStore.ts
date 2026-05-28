import { create } from 'zustand';
import type { Transaction } from '@/types';

interface SelectionState {
  selectedEnterpriseId: string | null;
  selectedTransactionId: string | null;
  highlightedTransactionIds: string[];
  hoveredEnterpriseId: string | null;

  selectEnterprise: (id: string | null, transactions: Transaction[]) => void;
  selectTransaction: (id: string | null) => void;
  highlightTransactions: (ids: string[]) => void;
  setHoveredEnterprise: (id: string | null) => void;
  clearSelection: () => void;
  focusOnEnterprise: (id: string) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedEnterpriseId: null,
  selectedTransactionId: null,
  highlightedTransactionIds: [],
  hoveredEnterpriseId: null,

  selectEnterprise: (id, transactions) => {
    if (id === null) {
      set({
        selectedEnterpriseId: null,
        highlightedTransactionIds: [],
      });
      return;
    }

    const relatedTransactionIds = transactions
      .filter((t) => t.fromId === id || t.toId === id)
      .map((t) => t.id);

    set({
      selectedEnterpriseId: id,
      selectedTransactionId: null,
      highlightedTransactionIds: relatedTransactionIds,
    });
  },

  selectTransaction: (id) => {
    set({ selectedTransactionId: id });
  },

  highlightTransactions: (ids) => {
    set({ highlightedTransactionIds: ids });
  },

  setHoveredEnterprise: (id) => {
    set({ hoveredEnterpriseId: id });
  },

  clearSelection: () => {
    set({
      selectedEnterpriseId: null,
      selectedTransactionId: null,
      highlightedTransactionIds: [],
      hoveredEnterpriseId: null,
    });
  },

  focusOnEnterprise: (id) => {
    set({ selectedEnterpriseId: id });
  },
}));
