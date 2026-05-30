
import { create } from 'zustand';
import { AppState, AppActions, Wallet, Transaction, WorkflowStatus } from '../types';
import { mockWallets, mockTransactions, getTimeRange } from '../utils/mockData';

const timeRange = getTimeRange();

export const useAppStore = create<AppState & AppActions>((set) => ({
  wallets: mockWallets,
  transactions: mockTransactions,
  selectedWalletId: null,
  highlightedPath: [],
  timeRange: timeRange,
  filterOptions: {
    showNormal: true,
    showWarning: true,
    showAnomaly: true,
    showPending: true,
    minAmount: 0,
    selectedTokens: ['ETH', 'USDC', 'USDT', 'WBTC', 'LINK'],
  },
  forceParams: {
    linkDistance: 120,
    linkStrength: 0.15,
    charge: -100,
    gravity: 0.01,
    centerStrength: 0.05,
  },
  isPlaying: false,
  playSpeed: 1,
  currentTime: timeRange[1],

  setSelectedWallet: (id) => set({ selectedWalletId: id }),
  setHighlightedPath: (path) => set({ highlightedPath: path }),
  setTimeRange: (range) => set({ timeRange: range }),
  setFilterOptions: (options) =>
    set((state) => ({
      filterOptions: { ...state.filterOptions, ...options },
    })),
  setForceParams: (params) =>
    set((state) => ({
      forceParams: { ...state.forceParams, ...params },
    })),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  setCurrentTime: (time) =>
    set((state) => ({
      currentTime: typeof time === 'function' ? time(state.currentTime) : time,
    })),
  updateWallet: (id, updates) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    })),
  updateTransaction: (id, updates) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  updateWalletTags: (id, tags) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === id ? { ...w, tags } : w
      ),
    })),
  updateWorkflowStatus: (txId, status) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === txId ? { ...t, workflowStatus: status } : t
      ),
    })),
}));

export const selectFilteredTransactions = (state: AppState): Transaction[] => {
  return state.transactions.filter((tx) => {
    const wallet = state.wallets.find((w) => w.id === tx.from || w.id === tx.to);
    if (!wallet) return false;
    const walletStatus = wallet.status;

    if (tx.amount < state.filterOptions.minAmount) return false;
    if (!state.filterOptions.selectedTokens.includes(tx.token)) return false;
    if (tx.timestamp < state.timeRange[0] || tx.timestamp > state.currentTime) return false;

    const statusMap = {
      normal: state.filterOptions.showNormal,
      warning: state.filterOptions.showWarning,
      anomaly: state.filterOptions.showAnomaly,
      pending: state.filterOptions.showPending,
      rejected: state.filterOptions.showAnomaly,
    };

    return statusMap[walletStatus] !== false;
  });
};

export const selectWalletTransactions = (walletId: string) => (state: AppState): Transaction[] => {
  return state.transactions.filter(
    (tx) => tx.from === walletId || tx.to === walletId
  );
};
