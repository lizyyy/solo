import { create } from 'zustand';
import type {
  BatchProcessResult,
  TideStationAnnotation,
  AnnotationVersion,
  ConsistencyResult,
  RemarkCorrection,
} from '@/engine/types';
import {
  runPipeline,
  reprocessBatchWithRemark,
  parseRemarkCorrections,
  generateCsvString,
  verifyConsistency,
  downloadCsv,
} from '@/engine/pipeline';
import { SAMPLE_BUOY_LOGS, SAMPLE_REMARK } from '@/engine/sampleLogs';

export interface WorldPoint {
  annotationId: string;
  x: number;
  z: number;
  y: number;
  isPending: boolean;
  pendingIndex: number;
}

const REF_LAT = 30;
const REF_LNG = 121;
const SCALE = 8;

export function annotationToWorld(ann: TideStationAnnotation, index: number, total: number): WorldPoint {
  const coords = ann.buoyRecord.coordinates;
  const hasValid =
    coords && coords.latitude != null && coords.longitude != null && ann.status !== 'exception';
  if (hasValid) {
    return {
      annotationId: ann.annotationId,
      x: (coords!.longitude! - REF_LNG) * SCALE,
      z: -(coords!.latitude! - REF_LAT) * SCALE,
      y: 0,
      isPending: false,
      pendingIndex: -1,
    };
  }
  // Pending-review zone: arranged in a row on the eastern edge.
  return {
    annotationId: ann.annotationId,
    x: 16 + (index % 3) * 3,
    z: -((index - (index % 3)) / 3) * 3 - 6,
    y: 0,
    isPending: true,
    pendingIndex: index,
  };
}

export type ViewPreset = 'overview' | 'side' | 'orbit';

interface TidalState {
  logText: string;
  batch: BatchProcessResult | null;
  selectedAnnotationId: string | null;
  remarkDraft: string;
  remarkTargetId: string | null;
  lastVersion: AnnotationVersion | null;
  consistency: ConsistencyResult | null;
  csvPreview: string;
  viewPreset: ViewPreset;
  focusAnnotationId: string | null;

  loadLogs: (text?: string) => void;
  selectStation: (id: string | null) => void;
  setRemarkDraft: (text: string) => void;
  setRemarkTarget: (id: string | null) => void;
  applyRemark: () => void;
  exportCsv: () => void;
  setViewPreset: (v: ViewPreset) => void;
  focusStation: (id: string | null) => void;
  detectRemark: () => RemarkCorrection;
  recalcConsistency: () => void;
}

export const useTidalStore = create<TidalState>((set, get) => ({
  logText: SAMPLE_BUOY_LOGS,
  batch: null,
  selectedAnnotationId: null,
  remarkDraft: '',
  remarkTargetId: null,
  lastVersion: null,
  consistency: null,
  csvPreview: '',
  viewPreset: 'overview',
  focusAnnotationId: null,

  loadLogs: (text) => {
    const logText = text ?? get().logText;
    const batch = runPipeline(logText);
    const csvPreview = generateCsvString(batch.annotations);
    const consistency = verifyConsistency(batch.annotations);
    set({
      logText,
      batch,
      selectedAnnotationId: null,
      remarkDraft: '',
      remarkTargetId: null,
      lastVersion: null,
      consistency,
      csvPreview,
      focusAnnotationId: null,
    });
  },

  selectStation: (id) => set({ selectedAnnotationId: id, focusAnnotationId: id }),

  setRemarkDraft: (text) => set({ remarkDraft: text }),

  setRemarkTarget: (id) => {
    const target = id ?? get().selectedAnnotationId;
    set({ remarkTargetId: target });
  },

  applyRemark: () => {
    const { batch, remarkDraft, remarkTargetId } = get();
    if (!batch || !remarkDraft.trim() || !remarkTargetId) return;
    const { batch: newBatch, version } = reprocessBatchWithRemark(batch, remarkTargetId, remarkDraft.trim());
    const csvPreview = generateCsvString(newBatch.annotations);
    const consistency = verifyConsistency(newBatch.annotations);
    set({
      batch: newBatch,
      lastVersion: version,
      remarkDraft: '',
      csvPreview,
      consistency,
      remarkTargetId: null,
    });
  },

  exportCsv: () => {
    const { batch } = get();
    if (!batch) return;
    const csv = generateCsvString(batch.annotations);
    downloadCsv(csv, `tidal_annotation_details_${batch.batchId}_v${batch.currentVersion}.csv`);
    const consistency = verifyConsistency(batch.annotations);
    set({ csvPreview: csv, consistency });
  },

  setViewPreset: (v) => set({ viewPreset: v }),

  focusStation: (id) => set({ focusAnnotationId: id }),

  detectRemark: () => parseRemarkCorrections(get().remarkDraft),

  recalcConsistency: () => {
    const { batch } = get();
    if (!batch) return;
    set({ consistency: verifyConsistency(batch.annotations) });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__tidalStore = useTidalStore;
}

export function getCounts(batch: BatchProcessResult | null) {
  if (!batch) return { ok: 0, pending: 0, exception: 0, total: 0 };
  let ok = 0;
  let pending = 0;
  let exception = 0;
  for (const ann of batch.annotations) {
    if (ann.status === 'exception') exception += 1;
    else if (ann.status === 'pending_review') pending += 1;
    else ok += 1;
  }
  return { ok, pending, exception, total: batch.annotations.length };
}

export const SAMPLE_REMARK_TEXT = SAMPLE_REMARK;
