import { create } from 'zustand';
import { api } from '@/lib/api';
import type { BatchData } from '@/types';

type UpdateRecordBody = { status?: string; current_step?: number };

interface ReviewState {
  batchData: BatchData | null;
  loading: boolean;
  selectedRecordId: string | null;
  fetchBatch: (importId: string) => Promise<void>;
  updateRecord: (recordId: string, body: UpdateRecordBody) => Promise<void>;
  editRecord: (recordId: string, field: string, newValue: string, editedBy: string) => Promise<void>;
  confirmSensorChange: (changeId: string, action: string, reviewedBy: string, note?: string) => Promise<void>;
}

const useReviewStore = create<ReviewState>((set, get) => ({
  batchData: null,
  loading: false,
  selectedRecordId: null,

  fetchBatch: async (importId) => {
    set({ loading: true, selectedRecordId: null });
    try {
      const data = await api.review.batch(importId);
      set({ batchData: data, loading: false });
    } catch (e: unknown) {
      set({ loading: false });
      throw e;
    }
  },

  updateRecord: async (recordId, body) => {
    const updated = await api.review.updateRecord(recordId, body);
    const { batchData } = get();
    if (batchData) {
      set({
        batchData: {
          ...batchData,
          records: batchData.records.map((r) => (r.id === recordId ? updated : r)),
        },
      });
    }
  },

  editRecord: async (recordId, field, newValue, editedBy) => {
    const updated = await api.review.editRecord(recordId, { field, new_value: newValue, edited_by: editedBy });
    const { batchData } = get();
    if (batchData) {
      set({
        batchData: {
          ...batchData,
          records: batchData.records.map((r) => (r.id === recordId ? updated : r)),
        },
      });
    }
  },

  confirmSensorChange: async (changeId, action, reviewedBy, note) => {
    const updated = await api.review.confirmSensorChange(changeId, { action, reviewed_by: reviewedBy, note });
    const { batchData } = get();
    if (batchData) {
      set({
        batchData: {
          ...batchData,
          sensorChanges: batchData.sensorChanges.map((c) => (c.id === changeId ? updated : c)),
        },
      });
    }
  },
}));

export default useReviewStore;
