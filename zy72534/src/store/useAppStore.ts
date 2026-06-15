import { create } from 'zustand';
import { Batch, Sample, Comment, Review, CommentAuthor, NextOwner } from '../types';
import { mockBatches, mockSamples } from '../data/mockData';
import { generateId } from '../utils/formatters';
import { detectAnomalies } from '../utils/anomalyDetector';

const STORAGE_KEY = 'material-tag-cold-start-store-v1';

type PersistedState = Pick<AppState, 'batches' | 'samples' | 'selectedBatchId'>;

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const persisted = loadPersistedState();
const initialState = persisted ?? {
  batches: mockBatches,
  samples: mockSamples,
  selectedBatchId: 'batch-001' as string | null,
};

interface AppState {
  batches: Batch[];
  samples: Sample[];
  selectedBatchId: string | null;
  resetStore: () => void;
  setSelectedBatchId: (id: string | null) => void;
  addBatch: (batch: Omit<Batch, 'id' | 'anomalyCount'>) => Batch;
  addSamples: (samples: Omit<Sample, 'id' | 'isAnomaly'>[]) => void;
  addComment: (sampleId: string, author: CommentAuthor, content: string) => void;
  updateSampleStatus: (sampleId: string, status: Sample['status']) => void;
  updateReview: (sampleId: string, review: Partial<Review>) => void;
  getSampleById: (id: string) => Sample | undefined;
  getSamplesByBatch: (batchId: string) => Sample[];
  getAnomalySamples: () => Sample[];
}

function persistSnapshot(get: () => AppState) {
  const { batches, samples, selectedBatchId } = get();
  savePersistedState({ batches, samples, selectedBatchId });
}

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  resetStore: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      batches: mockBatches,
      samples: mockSamples,
      selectedBatchId: 'batch-001',
    });
  },

  setSelectedBatchId: (id) => {
    set({ selectedBatchId: id });
    persistSnapshot(get);
  },

  addBatch: (batch) => {
    const newBatch: Batch = {
      ...batch,
      id: `batch-${generateId()}`,
      anomalyCount: 0,
    };
    set((state) => ({
      batches: [...state.batches, newBatch],
      selectedBatchId: newBatch.id,
    }));
    persistSnapshot(get);
    return newBatch;
  },

  addSamples: (newSamples) => {
    const { selectedBatchId } = get();
    if (!selectedBatchId) return;

    const samplesWithIds: Sample[] = newSamples.map((s) => {
      const uniqueVersions = new Set(s.versions.map(v => v.modelVersion));
      const isAnomaly = uniqueVersions.size > 1;
      const hasComments = s.comments.length > 0;

      let explanation = s.review?.explanation || '';
      if (!explanation) {
        if (isAnomaly) {
          const versionList = s.versions.map(v => v.modelVersion).join(' → ');
          explanation = `灰度批次第一次导入：样本编号 ${s.sampleNo} 出现了 ${s.versions.length} 个模型版本（${versionList}），但样本编号没变。系统未自动归为正常，已留给运营复核人确认。`;
        } else {
          explanation = `灰度批次导入：样本编号 ${s.sampleNo}，模型版本 ${s.currentModelVersion}，标签预测无版本冲突。`;
        }
      }

      let missingMaterials = s.review?.missingMaterials || [];
      if (isAnomaly && missingMaterials.length === 0 && !hasComments) {
        missingMaterials = ['标注员留言补录'];
      }

      const nextOwner = s.review?.nextOwner || (
        isAnomaly && !hasComments ? '模型评测小孟' :
        isAnomaly && hasComments ? '运营复核人' : '模型评测小孟'
      );

      return {
        ...s,
        id: `sample-${generateId()}`,
        isAnomaly: false,
        status: isAnomaly ? 'pending_review' : s.status,
        review: {
          explanation,
          missingMaterials,
          nextOwner,
          updatedAt: new Date().toISOString(),
        },
      };
    });

    const detected = detectAnomalies(samplesWithIds);
    const anomalyCount = detected.filter((s) => s.isAnomaly).length;

    set((state) => ({
      samples: [...state.samples, ...detected],
      batches: state.batches.map((b) =>
        b.id === selectedBatchId
          ? { ...b, totalSamples: detected.length, anomalyCount: anomalyCount }
          : b
      ),
    }));
    persistSnapshot(get);
  },

  addComment: (sampleId, author, content) => {
    const newComment: Comment = {
      id: `comment-${generateId()}`,
      author,
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      samples: state.samples.map((s) => {
        if (s.id !== sampleId) return s;

        const nextComments = [...s.comments, newComment];
        const authorNames = nextComments.map(c => c.author);
        const hasAnnotatorComment = authorNames.includes('标注员');

        let nextReview = s.review;
        if (nextReview) {
          const updatedMaterials = nextReview.missingMaterials.filter(
            m => m !== '标注员留言补录'
          );
          const hasMissing = updatedMaterials.length > 0;

          let nextOwner = nextReview.nextOwner;
          if (s.isAnomaly) {
            nextOwner = hasMissing ? '模型评测小孟' : '运营复核人';
          }

          let explanation = nextReview.explanation;
          if (hasAnnotatorComment && s.isAnomaly) {
            const versionList = s.versions.map(v => v.modelVersion).join(' → ');
            explanation = `灰度批次第一次导入时出现模型版本冲突（${versionList}），已标记异常并留给运营复核。模型评测同事小孟已补看标注员留言，请运营复核人基于留言和版本对比给出结论。`;
          }

          nextReview = {
            ...nextReview,
            missingMaterials: updatedMaterials,
            nextOwner,
            explanation,
            updatedAt: new Date().toISOString(),
          };
        }

        return {
          ...s,
          comments: nextComments,
          review: nextReview,
        };
      }),
    }));
    persistSnapshot(get);
  },

  updateSampleStatus: (sampleId, status) => {
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId ? { ...s, status } : s
      ),
    }));
    persistSnapshot(get);
  },

  updateReview: (sampleId, reviewUpdate) => {
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? {
              ...s,
              review: {
                explanation: reviewUpdate.explanation || s.review?.explanation || '',
                missingMaterials: reviewUpdate.missingMaterials || s.review?.missingMaterials || [],
                nextOwner: (reviewUpdate.nextOwner as NextOwner) || s.review?.nextOwner || '模型评测小孟',
                updatedAt: new Date().toISOString(),
              },
            }
          : s
      ),
    }));
    persistSnapshot(get);
  },

  getSampleById: (id) => {
    return get().samples.find((s) => s.id === id);
  },

  getSamplesByBatch: (batchId) => {
    return get().samples.filter((s) => s.batchId === batchId);
  },

  getAnomalySamples: () => {
    return get().samples.filter((s) => s.isAnomaly);
  },
}));
