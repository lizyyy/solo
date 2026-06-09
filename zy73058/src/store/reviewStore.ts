import { create } from 'zustand';
import type { ReviewRecord, ReviewStatus, SparePart } from '@/types';
import { mockReviewRecords, sparePartsMap } from '@/data/mockData';

interface ReviewState {
  records: ReviewRecord[];
  statusFilter: ReviewStatus | 'all';
  searchText: string;
  activeRecordId: string | null;
  highlightSparePartId: string | null;
  setStatusFilter: (s: ReviewStatus | 'all') => void;
  setSearchText: (t: string) => void;
  setActiveRecordId: (id: string | null) => void;
  setHighlightSparePartId: (id: string | null) => void;
  updateRecordStatus: (id: string, status: ReviewStatus) => void;
  getFilteredRecords: () => ReviewRecord[];
  getThresholdRecords: () => ReviewRecord[];
  getStatusCounts: () => { confirmed: number; pending: number; rejected: number };
  getSparePartById: (id: string) => SparePart | undefined;
  getAllSpareParts: () => SparePart[];
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  records: mockReviewRecords,
  statusFilter: 'all',
  searchText: '',
  activeRecordId: null,
  highlightSparePartId: null,

  setStatusFilter: (s) => set({ statusFilter: s }),
  setSearchText: (t) => set({ searchText: t }),
  setActiveRecordId: (id) => set({ activeRecordId: id }),
  setHighlightSparePartId: (id) => set({ highlightSparePartId: id }),

  updateRecordStatus: (id, status) =>
    set({
      records: get().records.map((r) => (r.id === id ? { ...r, status } : r)),
    }),

  getFilteredRecords: () => {
    const { records, statusFilter, searchText } = get();
    const t = searchText.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!t) return true;
      return (
        r.id.toLowerCase().includes(t) ||
        r.elevatorId.toLowerCase().includes(t) ||
        r.summary.toLowerCase().includes(t) ||
        r.faultType.toLowerCase().includes(t)
      );
    });
  },

  getThresholdRecords: () => get().records.filter((r) => r.hasThresholdAdjustment),

  getStatusCounts: () => {
    const { records } = get();
    return records.reduce(
      (acc, r) => {
        acc[r.status]++;
        return acc;
      },
      { confirmed: 0, pending: 0, rejected: 0 }
    );
  },

  getSparePartById: (id) => sparePartsMap[id],
  getAllSpareParts: () => Object.values(sparePartsMap),
}));
