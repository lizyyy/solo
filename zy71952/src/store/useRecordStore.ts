import { create } from 'zustand';
import type { FlightRecord, RecordStatus } from '../types';
import { mockFlightRecords, handlingSummary } from '../data/mockData';

interface RecordState {
  records: FlightRecord[];
  selectedRecordId: string | null;
  statusFilter: 'all' | RecordStatus;
  reviewChecklist: {
    weatherChecked: boolean;
    returnPointChecked: boolean;
    modificationChecked: boolean;
    classificationChecked: boolean;
  };
  getSelectedRecord: () => FlightRecord | undefined;
  getFilteredRecords: () => FlightRecord[];
  getStatusCounts: () => { confirmed: number; pending: number; modified: number };
  setSelectedRecordId: (id: string | null) => void;
  setStatusFilter: (filter: 'all' | RecordStatus) => void;
  toggleChecklistItem: (item: keyof RecordState['reviewChecklist']) => void;
  isChecklistComplete: () => boolean;
  generateReviewReport: () => {
    generatedAt: string;
    totalRecords: number;
    confirmedCount: number;
    pendingCount: number;
    modifiedCount: number;
    records: {
      confirmed: FlightRecord[];
      pending: FlightRecord[];
      modified: FlightRecord[];
    };
    handlingSummary: string;
    reviewedBy: string;
  };
  resetChecklist: () => void;
}

export const useRecordStore = create<RecordState>((set, get) => ({
  records: mockFlightRecords,
  selectedRecordId: mockFlightRecords[0]?.id || null,
  statusFilter: 'all',
  reviewChecklist: {
    weatherChecked: false,
    returnPointChecked: false,
    modificationChecked: false,
    classificationChecked: false,
  },

  getSelectedRecord: () => {
    const { records, selectedRecordId } = get();
    return records.find(r => r.id === selectedRecordId);
  },

  getFilteredRecords: () => {
    const { records, statusFilter } = get();
    if (statusFilter === 'all') return records;
    return records.filter(r => r.status === statusFilter);
  },

  getStatusCounts: () => {
    const { records } = get();
    return {
      confirmed: records.filter(r => r.status === 'confirmed').length,
      pending: records.filter(r => r.status === 'pending').length,
      modified: records.filter(r => r.status === 'modified').length,
    };
  },

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),

  setStatusFilter: (filter) => set({ statusFilter: filter }),

  toggleChecklistItem: (item) => set((state) => ({
    reviewChecklist: {
      ...state.reviewChecklist,
      [item]: !state.reviewChecklist[item],
    },
  })),

  isChecklistComplete: () => {
    const { reviewChecklist } = get();
    return Object.values(reviewChecklist).every(v => v);
  },

  generateReviewReport: () => {
    const { records } = get();
    const confirmed = records.filter(r => r.status === 'confirmed');
    const pending = records.filter(r => r.status === 'pending');
    const modified = records.filter(r => r.status === 'modified');

    return {
      generatedAt: new Date().toLocaleString('zh-CN'),
      totalRecords: records.length,
      confirmedCount: confirmed.length,
      pendingCount: pending.length,
      modifiedCount: modified.length,
      records: { confirmed, pending, modified },
      handlingSummary,
      reviewedBy: '当前用户',
    };
  },

  resetChecklist: () => set({
    reviewChecklist: {
      weatherChecked: false,
      returnPointChecked: false,
      modificationChecked: false,
      classificationChecked: false,
    },
  }),
}));
