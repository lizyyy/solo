
import { create } from 'zustand';
import { Sample, DetectionResult, ReviewRecord, Report, TrendData, SourceType, Evidence } from '../types';
import { mockSamples, mockDetections, mockReviews, mockReport, mockTrendData } from '../data/mockData';

const STORAGE_KEY = 'intent_drift_monitor_state';

const SOURCE_PRIORITY: Record<SourceType, number> = { online: 3, manual: 2, model: 1 };

function loadFromStorage(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveToStorage(state: AppState) {
  try {
    const toSave = {
      samples: state.samples,
      detections: state.detections,
      reviews: state.reviews,
      report: state.report,
      trendData: state.trendData,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

function mergeSources(a: SourceType[], b: SourceType[]): SourceType[] {
  return Array.from(new Set([...(a || []), ...(b || [])]));
}

function pickPrimarySource(sources: SourceType[]): SourceType {
  if (!sources || sources.length === 0) return 'model';
  return sources.reduce((best, s) =>
    SOURCE_PRIORITY[s] > SOURCE_PRIORITY[best] ? s : best
  , sources[0]);
}

function mergeEvidences(a: Evidence[], b: Evidence[]): Evidence[] {
  const seen = new Map<string, Evidence>();
  for (const e of a || []) seen.set(`${e.type}:${e.content}`, e);
  for (const e of b || []) seen.set(`${e.type}:${e.content}`, e);
  return Array.from(seen.values());
}

function mergeDetection(
  existing: DetectionResult | undefined,
  incoming: DetectionResult,
  incomingSource: SourceType = 'model'
): DetectionResult {
  if (!existing) return incoming;
  const evidences = mergeEvidences(existing.evidences, incoming.evidences);
  const canOverrideModel = incomingSource === 'model';
  const modelIntent = canOverrideModel ? incoming.modelIntent : existing.modelIntent;
  const modelConfidence = canOverrideModel ? incoming.modelConfidence : existing.modelConfidence;
  const manualIntent = incoming.manualIntent || existing.manualIntent;
  const isDrift = incoming.isDrift ?? existing.isDrift;
  const driftScore = incoming.driftScore ?? existing.driftScore;
  const hasConflict = !!(
    manualIntent && modelIntent && manualIntent !== modelIntent
  );
  return {
    id: existing.id,
    sampleId: existing.sampleId,
    modelIntent,
    modelConfidence,
    manualIntent,
    isDrift,
    driftScore,
    thresholdVersion: incoming.thresholdVersion || existing.thresholdVersion,
    detectedAt: incoming.detectedAt || existing.detectedAt,
    evidences,
    hasConflict,
  };
}

function classifySamples(
  samples: Sample[],
  detections: DetectionResult[],
  reviews: ReviewRecord[]
): { modelDecision: string[]; manualCorrection: string[]; needReview: string[] } {
  const modelDecision: string[] = [];
  const manualCorrection: string[] = [];
  const needReview: string[] = [];

  for (const sample of samples) {
    const review = reviews.find((r) => r.sampleId === sample.id);
    const detection = detections.find((d) => d.sampleId === sample.id);

    if (sample.status === 'completed') {
      if (review && detection && review.finalIntent !== detection.modelIntent) {
        manualCorrection.push(sample.id);
      } else {
        modelDecision.push(sample.id);
      }
    } else {
      needReview.push(sample.id);
    }
  }

  return { modelDecision, manualCorrection, needReview };
}

function generateDetectionForSample(sample: Sample, overrides: Partial<DetectionResult> = {}): DetectionResult {
  const now = new Date().toISOString();
  const driftScore = overrides.driftScore ?? 0.15 + Math.random() * 0.2;
  const isDrift = overrides.isDrift ?? driftScore > 0.3;
  const modelIntent = overrides.modelIntent ?? sample.originalIntent;
  const modelConfidence = overrides.modelConfidence ?? 0.65;
  const manualIntent = overrides.manualIntent;
  const hasConflict = !!(
    manualIntent && modelIntent && manualIntent !== modelIntent
  );
  const evidences: Evidence[] = [
    {
      id: `E_${sample.id}_model_${Date.now()}`,
      type: 'model_output',
      content: `模型输出：【${modelIntent}】置信度 ${Math.round(modelConfidence * 100)}%；原始标注：【${sample.originalIntent}】`,
      highlight: [modelIntent, sample.originalIntent],
    },
    {
      id: `E_${sample.id}_thr_${Date.now()}`,
      type: 'threshold_config',
      content: `阈值版本 v2.1：漂移分数 > 0.30 判定为漂移，当前分数 ${driftScore.toFixed(2)}${isDrift ? '，已超过阈值' : '，未超过阈值'}`,
      highlight: [driftScore.toFixed(2), 'v2.1'],
    },
    ...(manualIntent
      ? [{
          id: `E_${sample.id}_manual_${Date.now()}`,
          type: 'manual_label' as const,
          content: `人工标注意图：【${manualIntent}】${hasConflict ? '，与模型判断不一致，存在冲突' : ''}`,
          highlight: [manualIntent],
        }]
      : []),
  ];

  return {
    id: overrides.id ?? `D_${sample.id}_${Date.now()}`,
    sampleId: sample.id,
    modelIntent,
    modelConfidence,
    manualIntent,
    isDrift,
    driftScore,
    thresholdVersion: overrides.thresholdVersion ?? 'v2.1',
    detectedAt: overrides.detectedAt ?? now,
    evidences,
    hasConflict,
  };
}

export interface ImportResult {
  createdSamples: number;
  mergedSamples: number;
  createdDetections: number;
  mergedDetections: number;
  skippedSamples: number;
}

interface AppState {
  samples: Sample[];
  detections: DetectionResult[];
  reviews: ReviewRecord[];
  report: Report;
  trendData: TrendData[];
  selectedSampleId: string | null;
  isRunningDetection: boolean;

  setSelectedSampleId: (id: string | null) => void;
  getSampleById: (id: string) => Sample | undefined;
  getDetectionBySampleId: (sampleId: string) => DetectionResult | undefined;
  getReviewBySampleId: (sampleId: string) => ReviewRecord | undefined;

  runDetection: () => Promise<void>;
  updateSampleStatus: (sampleId: string, status: Sample['status']) => void;
  addReview: (review: Omit<ReviewRecord, 'id' | 'reviewedAt'>) => void;
  updateReviewRemark: (sampleId: string, remark: string) => void;
  generateReport: () => void;
  importSamples: (newSamples: Sample[], newDetections: DetectionResult[]) => ImportResult;
  resetToDefault: () => void;
}

const saved = loadFromStorage();

export const useAppStore = create<AppState>((set, get) => ({
  samples: saved?.samples ?? mockSamples,
  detections: saved?.detections ?? mockDetections,
  reviews: saved?.reviews ?? mockReviews,
  report: saved?.report ?? mockReport,
  trendData: saved?.trendData ?? mockTrendData,
  selectedSampleId: null,
  isRunningDetection: false,

  setSelectedSampleId: (id) => set({ selectedSampleId: id }),

  getSampleById: (id) => get().samples.find((s) => s.id === id),

  getDetectionBySampleId: (sampleId) => get().detections.find((d) => d.sampleId === sampleId),

  getReviewBySampleId: (sampleId) => get().reviews.find((r) => r.sampleId === sampleId),

  runDetection: async () => {
    set({ isRunningDetection: true });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    set((state) => {
      const now = new Date().toISOString();
      const pendingSamples = state.samples.filter((s) => s.status === 'pending');
      const newDetections: DetectionResult[] = [];
      const updatedDetectionMap = new Map(state.detections.map((d) => [d.sampleId, d]));

      for (const sample of pendingSamples) {
        const existing = updatedDetectionMap.get(sample.id);
        if (!existing) {
          const det = generateDetectionForSample(sample);
          newDetections.push(det);
          updatedDetectionMap.set(sample.id, det);
        }
      }

      const updatedSamples = state.samples.map((s) =>
        s.status === 'pending' ? { ...s, status: 'detected' as const, updatedAt: now } : s
      );

      const updatedDetections = [...state.detections, ...newDetections];

      const updated = {
        samples: updatedSamples,
        detections: updatedDetections,
        isRunningDetection: false,
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    });
  },

  updateSampleStatus: (sampleId, status) =>
    set((state) => {
      const updated = {
        samples: state.samples.map((s) =>
          s.id === sampleId ? { ...s, status, updatedAt: new Date().toISOString() } : s
        ),
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    }),

  addReview: (review) =>
    set((state) => {
      const updated = {
        reviews: [
          ...state.reviews,
          {
            ...review,
            id: `R${Date.now()}`,
            reviewedAt: new Date().toISOString(),
          },
        ],
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    }),

  updateReviewRemark: (sampleId, remark) =>
    set((state) => {
      const updated = {
        reviews: state.reviews.map((r) =>
          r.sampleId === sampleId
            ? {
                ...r,
                isRemarkAdded: true,
                remarkDiff: {
                  before: r.remark || '',
                  after: remark,
                },
                remark,
              }
            : r
        ),
      };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    }),

  generateReport: () => {
    const state = get();
    const totalSamples = state.samples.length;
    const classified = classifySamples(state.samples, state.detections, state.reviews);
    const driftSamples = state.detections.filter((d) => d.isDrift).length;
    const driftRate = totalSamples > 0 ? Math.round((driftSamples / totalSamples) * 1000) / 10 : 0;

    const updated = {
      report: {
        id: `REP${Date.now()}`,
        name: `${new Date().toISOString().split('T')[0]} 客服意图漂移检测报告`,
        generatedAt: new Date().toISOString(),
        statistics: {
          totalSamples,
          modelDecision: classified.modelDecision.length,
          manualCorrection: classified.manualCorrection.length,
          needReview: classified.needReview.length,
          driftRate,
        },
        samples: classified,
      },
    };
    set((state) => {
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    });
  },

  importSamples: (incomingSamples, incomingDetections) => {
    const state = get();
    const now = new Date().toISOString();
    const result: ImportResult = {
      createdSamples: 0,
      mergedSamples: 0,
      createdDetections: 0,
      mergedDetections: 0,
      skippedSamples: 0,
    };

    const existingByKey = new Map<string, Sample>();
    for (const s of state.samples) {
      if (s.sampleKey) existingByKey.set(s.sampleKey, s);
      existingByKey.set(s.id, s);
    }
    const existingDetectionsBySample = new Map(state.detections.map((d) => [d.sampleId, d]));
    const incomingByKey = new Map<string, Sample>();
    for (const s of incomingSamples) {
      if (s.sampleKey) incomingByKey.set(s.sampleKey, s);
      incomingByKey.set(s.id, s);
    }
    const incomingDetectionsBySample = new Map(incomingDetections.map((d) => [d.sampleId, d]));

    const finalSamples: Sample[] = [...state.samples];
    const finalDetections: DetectionResult[] = [...state.detections];
    const processedSampleIds = new Set<string>();

    for (const incoming of incomingSamples) {
      const matchKey = incoming.sampleKey || incoming.id;
      const existing = existingByKey.get(matchKey);

      if (existing) {
        const mergedSources = mergeSources(existing.sources, incoming.sources);
        const merged: Sample = {
          ...existing,
          sampleKey: existing.sampleKey || incoming.sampleKey,
          content: incoming.content || existing.content,
          originalIntent: incoming.originalIntent || existing.originalIntent,
          sources: mergedSources,
          source: pickPrimarySource(mergedSources),
          status: existing.status === 'completed' ? existing.status : (
            incoming.status === 'completed' ? 'completed' : (
              existing.status === 'reviewing' || incoming.status === 'reviewing' ? 'reviewing' : (
                existing.status === 'detected' || incoming.status === 'detected' ? 'detected' : 'pending'
              )
            )
          ),
          updatedAt: now,
          createdAt: existing.createdAt,
        };
        const idx = finalSamples.findIndex((s) => s.id === existing.id);
        if (idx >= 0) finalSamples[idx] = merged;
        result.mergedSamples++;

        const incDet = incomingDetectionsBySample.get(incoming.id);
        const curDet = existingDetectionsBySample.get(existing.id);
        if (incDet) {
          const mergedDet = mergeDetection(curDet, { ...incDet, sampleId: existing.id }, incoming.source);
          if (curDet) {
            const didx = finalDetections.findIndex((d) => d.sampleId === existing.id);
            if (didx >= 0) finalDetections[didx] = mergedDet;
            result.mergedDetections++;
          } else {
            finalDetections.push(mergedDet);
            result.createdDetections++;
          }
        } else if (!curDet) {
          finalDetections.push(generateDetectionForSample(merged));
          result.createdDetections++;
        }
        processedSampleIds.add(existing.id);
      } else {
        if (!incoming.content || !incoming.originalIntent) {
          result.skippedSamples++;
          continue;
        }
        const newSample: Sample = {
          ...incoming,
          sources: incoming.sources && incoming.sources.length > 0 ? incoming.sources : [incoming.source],
          updatedAt: now,
        };
        finalSamples.push(newSample);
        result.createdSamples++;

        const incDet = incomingDetectionsBySample.get(incoming.id);
        if (incDet) {
          finalDetections.push(incDet);
          result.createdDetections++;
        } else {
          finalDetections.push(generateDetectionForSample(newSample));
          result.createdDetections++;
        }
        processedSampleIds.add(newSample.id);
      }
    }

    set(() => {
      const updated = { samples: finalSamples, detections: finalDetections };
      const newState = { ...state, ...updated };
      saveToStorage(newState as AppState);
      return updated;
    });

    return result;
  },

  resetToDefault: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      samples: mockSamples,
      detections: mockDetections,
      reviews: mockReviews,
      report: mockReport,
      trendData: mockTrendData,
    });
  },
}));
