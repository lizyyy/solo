import { create } from 'zustand';
import type {
  Period,
  Enterprise,
  Transaction,
  Gap,
  Issue,
  Snapshot,
  DiffResult,
} from '@/types';

const SNAPSHOTS_STORAGE_KEY = 'carbon_trading_snapshots';

interface SetDataPayload {
  periods: Period[];
  enterprises: Enterprise[];
  transactions: Transaction[];
  gaps: Gap[];
  issues: Issue[];
}

interface DataState {
  periods: Period[];
  enterprises: Enterprise[];
  transactions: Transaction[];
  gaps: Gap[];
  issues: Issue[];
  snapshots: Snapshot[];
  currentSnapshotId: string | null;
  isCompareMode: boolean;
  compareSnapshotId: string | null;

  setData: (data: SetDataPayload) => void;
  updateEnterprise: (id: string, updates: Partial<Enterprise>) => void;
  addTransaction: (transaction: Transaction) => void;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  createSnapshot: (description: string) => Snapshot;
  loadSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  toggleCompareMode: (snapshotId?: string) => void;
  applyDiff: (diff: DiffResult) => void;
}

const loadSnapshotsFromStorage = (): Snapshot[] => {
  try {
    const stored = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveSnapshotsToStorage = (snapshots: Snapshot[]) => {
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    console.error('Failed to save snapshots to localStorage');
  }
};

export const useDataStore = create<DataState>((set, get) => ({
  periods: [],
  enterprises: [],
  transactions: [],
  gaps: [],
  issues: [],
  snapshots: loadSnapshotsFromStorage(),
  currentSnapshotId: null,
  isCompareMode: false,
  compareSnapshotId: null,

  setData: (data) => {
    set({
      periods: data.periods,
      enterprises: data.enterprises,
      transactions: data.transactions,
      gaps: data.gaps,
      issues: data.issues,
    });
  },

  updateEnterprise: (id, updates) => {
    set((state) => ({
      enterprises: state.enterprises.map((ent) =>
        ent.id === id ? { ...ent, ...updates } : ent
      ),
    }));
  },

  addTransaction: (transaction) => {
    set((state) => ({
      transactions: [...state.transactions, transaction],
    }));
  },

  updateIssue: (id, updates) => {
    set((state) => ({
      issues: state.issues.map((issue) =>
        issue.id === id ? { ...issue, ...updates } : issue
      ),
    }));
  },

  createSnapshot: (description) => {
    const state = get();
    const newSnapshot: Snapshot = {
      id: `snapshot_${Date.now()}`,
      timestamp: Date.now(),
      description,
      data: {
        enterprises: [...state.enterprises],
        transactions: [...state.transactions],
        gaps: [...state.gaps],
        issues: [...state.issues],
      },
    };

    const updatedSnapshots = [...state.snapshots, newSnapshot];
    set({
      snapshots: updatedSnapshots,
      currentSnapshotId: newSnapshot.id,
    });

    saveSnapshotsToStorage(updatedSnapshots);
    return newSnapshot;
  },

  loadSnapshot: (id) => {
    const snapshot = get().snapshots.find((s) => s.id === id);
    if (snapshot) {
      set({
        enterprises: [...snapshot.data.enterprises],
        transactions: [...snapshot.data.transactions],
        gaps: [...snapshot.data.gaps],
        issues: [...snapshot.data.issues],
        currentSnapshotId: id,
      });
    }
  },

  deleteSnapshot: (id) => {
    const state = get();
    const updatedSnapshots = state.snapshots.filter((s) => s.id !== id);
    const newCurrentId = state.currentSnapshotId === id ? null : state.currentSnapshotId;
    const newCompareId = state.compareSnapshotId === id ? null : state.compareSnapshotId;

    set({
      snapshots: updatedSnapshots,
      currentSnapshotId: newCurrentId,
      compareSnapshotId: newCompareId,
      isCompareMode: newCompareId ? state.isCompareMode : false,
    });

    saveSnapshotsToStorage(updatedSnapshots);
  },

  toggleCompareMode: (snapshotId) => {
    const state = get();
    if (snapshotId) {
      set({
        isCompareMode: true,
        compareSnapshotId: snapshotId,
      });
    } else {
      set({
        isCompareMode: !state.isCompareMode,
        compareSnapshotId: state.isCompareMode ? null : state.compareSnapshotId,
      });
    }
  },

  applyDiff: (diff) => {
    set((state) => {
      let enterprises = [...state.enterprises];
      let transactions = [...state.transactions];
      let gaps = [...state.gaps];
      let issues = [...state.issues];

      enterprises = enterprises.filter(
        (e) => !diff.removed.enterprises.some((r) => r.id === e.id)
      );
      transactions = transactions.filter(
        (t) => !diff.removed.transactions.some((r) => r.id === t.id)
      );
      gaps = gaps.filter((g) => !diff.removed.gaps.some((r) => r.id === g.id)
      );
      issues = issues.filter(
        (i) => !diff.removed.issues.some((r) => r.id === i.id)
      );

      enterprises = [...enterprises, ...diff.added.enterprises];
      transactions = [...transactions, ...diff.added.transactions];
      gaps = [...gaps, ...diff.added.gaps];
      issues = [...issues, ...diff.added.issues];

      enterprises = enterprises.map((e) => {
        const modified = diff.modified.enterprises.find((m) => m.id === e.id);
        return modified ? { ...e, ...modified } : e;
      });
      transactions = transactions.map((t) => {
        const modified = diff.modified.transactions.find((m) => m.id === t.id);
        return modified ? { ...t, ...modified } : t;
      });
      gaps = gaps.map((g) => {
        const modified = diff.modified.gaps.find((m) => m.id === g.id);
        return modified ? { ...g, ...modified } : g;
      });
      issues = issues.map((i) => {
        const modified = diff.modified.issues.find((m) => m.id === i.id);
        return modified ? { ...i, ...modified } : i;
      });

      return { enterprises, transactions, gaps, issues };
    });
  },
}));
