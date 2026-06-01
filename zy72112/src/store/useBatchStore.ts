import { create } from 'zustand';
import type { Batch, SensorRecord, Note, ValidationSummary } from '../types';
import { createSampleBatch, createSupplementaryNote, createRerunBatch } from '../utils/mockData';
import { validateRecord } from '../utils/validator';
import { compareRecords } from '../utils/diffEngine';

interface BatchState {
  batches: Batch[];
  currentBatchId: string | null;
  selectedRecordId: string | null;

  loadSampleBatch: () => void;
  setCurrentBatch: (id: string) => void;
  setSelectedRecord: (id: string | null) => void;
  confirmRecord: (recordId: string, confirmed: boolean, reason?: string) => void;
  addNote: (recordId: string, content: string, author: string) => void;
  rerunBatch: (batchId: string) => string | null;
  getCurrentBatch: () => Batch | null;
  getRecord: (recordId: string) => SensorRecord | null;
  getValidationSummary: (batchId: string) => ValidationSummary;
  getComparison: (batchId: string) => { oldBatch: Batch; newBatch: Batch; diffs: ReturnType<typeof compareRecords>[] } | null;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  batches: [],
  currentBatchId: null,
  selectedRecordId: null,

  loadSampleBatch: () => {
    const existing = get().batches.find(b => b.id === 'batch-demo-001');
    if (existing) {
      set({ currentBatchId: existing.id });
      return;
    }
    const batch = createSampleBatch();
    set(state => ({
      batches: [...state.batches, batch],
      currentBatchId: batch.id,
    }));
  },

  setCurrentBatch: (id) => set({ currentBatchId: id }),

  setSelectedRecord: (id) => set({ selectedRecordId: id }),

  confirmRecord: (recordId, confirmed, reason) => {
    set(state => ({
      batches: state.batches.map(batch => ({
        ...batch,
        records: batch.records.map(rec => {
          if (rec.id !== recordId) return rec;
          const newNote: Note = {
            id: `note-confirm-${Date.now()}`,
            content: confirmed
              ? `人工确认通过${reason ? '：' + reason : ''}`
              : `人工驳回${reason ? '：' + reason : ''}`,
            author: '林老师',
            createdAt: new Date().toISOString(),
            isSupplementary: false,
          };
          return {
            ...rec,
            status: confirmed ? 'confirmed' : 'rejected',
            notes: [...rec.notes, newNote],
          };
        }),
      })),
    }));
  },

  addNote: (recordId, content, author) => {
    const note = createSupplementaryNote(recordId, content, author);
    set(state => ({
      batches: state.batches.map(batch => ({
        ...batch,
        records: batch.records.map(rec => {
          if (rec.id !== recordId) return rec;
          const oldValues = {
            gap: rec.gap.calculated,
            height: rec.height.calculated,
            current: rec.current.calculated,
            dx: rec.direction.x,
            dy: rec.direction.y,
          };
          const newNote: Note = {
            ...note,
            diff: {
              field: '备注补录',
              oldValue: `间隙${oldValues.gap.toFixed(2)}mm / 高度${oldValues.height.toFixed(2)}mm / 电流${oldValues.current.toFixed(2)}A`,
              newValue: content,
            },
          };
          return {
            ...rec,
            notes: [...rec.notes, newNote],
            siteRemark: rec.siteRemark
              ? `${rec.siteRemark}；[补录] ${content}`
              : `[补录] ${content}`,
          };
        }),
      })),
    }));
  },

  rerunBatch: (batchId) => {
    const original = get().batches.find(b => b.id === batchId);
    if (!original) return null;
    const rerun = createRerunBatch(original);
    set(state => ({
      batches: [...state.batches, rerun],
      currentBatchId: rerun.id,
    }));
    return rerun.id;
  },

  getCurrentBatch: () => {
    const { batches, currentBatchId } = get();
    return batches.find(b => b.id === currentBatchId) || null;
  },

  getRecord: (recordId) => {
    for (const batch of get().batches) {
      const rec = batch.records.find(r => r.id === recordId);
      if (rec) return rec;
    }
    return null;
  },

  getValidationSummary: (batchId) => {
    const batch = get().batches.find(b => b.id === batchId);
    if (!batch) {
      return {
        unitCheck: { pass: 0, total: 0, warnings: [] },
        directionCheck: { pass: 0, total: 0, warnings: [] },
        intervalCheck: { pass: 0, total: 0, warnings: [] },
      };
    }

    const summary: ValidationSummary = {
      unitCheck: { pass: 0, total: 0, warnings: [] },
      directionCheck: { pass: 0, total: 0, warnings: [] },
      intervalCheck: { pass: 0, total: 0, warnings: [] },
    };

    for (const rec of batch.records) {
      for (const step of rec.checkSteps) {
        if (step.checkType === 'unit') {
          summary.unitCheck.total++;
          if (step.judgment === 'pass') summary.unitCheck.pass++;
          if (step.judgment !== 'pass') summary.unitCheck.warnings.push(step.suggestion);
        } else if (step.checkType === 'direction') {
          summary.directionCheck.total++;
          if (step.judgment === 'pass') summary.directionCheck.pass++;
          if (step.judgment !== 'pass') summary.directionCheck.warnings.push(step.suggestion);
        } else if (step.checkType === 'interval') {
          summary.intervalCheck.total++;
          if (step.judgment === 'pass') summary.intervalCheck.pass++;
          if (step.judgment !== 'pass') summary.intervalCheck.warnings.push(step.suggestion);
        }
      }
    }

    return summary;
  },

  getComparison: (batchId) => {
    const batch = get().batches.find(b => b.id === batchId);
    if (!batch || !batch.parentBatchId) return null;
    const parent = get().batches.find(b => b.id === batch.parentBatchId);
    if (!parent) return null;

    const diffs = batch.records.map((rec, idx) => {
      const oldRec = parent.records[idx];
      if (!oldRec) return [];
      return compareRecords(oldRec, rec);
    });

    return { oldBatch: parent, newBatch: batch, diffs };
  },
}));
