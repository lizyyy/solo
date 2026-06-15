import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import type {
  OnlineExperimentBucket,
  NegativeSample,
  EntityMergeRecord,
  VersionHistory,
  ViewMode,
  WorkflowStep,
  ModelParams,
} from '../types';

export type ScrollTarget = 'bucket' | 'negative' | 'merge' | null;
export type DrawerTabKey = 'basic' | 'summary' | 'history' | 'samples';

interface AppState {
  buckets: OnlineExperimentBucket[];
  negativeSamples: NegativeSample[];
  mergeRecords: EntityMergeRecord[];
  viewMode: ViewMode;
  currentStep: WorkflowStep;
  selectedBucketIds: string[];
  selectedRecordId: string | null;
  currentUser: string;
  selectedNegativeSampleIds: string[];
  selectedBucketForNegativeFilter: string | null;
  scrollTarget: ScrollTarget;
  highlightBucketId: string | null;
  highlightSampleIds: string[];
  drawerActiveTab: DrawerTabKey;
  lastUpdatedHistoryId: string | null;

  importBuckets: (buckets: Omit<OnlineExperimentBucket, 'id' | 'importTime' | 'importBatchId' | 'importedBy'>[]) => { added: number; skipped: number };
  addNegativeSamples: (samples: Omit<NegativeSample, 'id'>[]) => void;
  updateNegativeSampleReview: (sampleId: string, status: NegativeSample['reviewStatus'], note?: string) => void;
  updateMergeRemark: (recordId: string, newRemark: string, reason?: string) => string | null;
  setViewMode: (mode: ViewMode) => void;
  setCurrentStep: (step: WorkflowStep) => void;
  selectBucket: (bucketId: string) => void;
  deselectBucket: (bucketId: string) => void;
  selectRecord: (recordId: string | null) => void;
  selectNegativeSample: (sampleId: string) => void;
  deselectNegativeSample: (sampleId: string) => void;
  updateSummary: (recordId: string, summary: Partial<EntityMergeRecord['summary']>) => void;
  createMergeRecords: () => void;
  confirmRecord: (recordId: string) => void;
  rejectRecord: (recordId: string) => void;
  getBucketById: (bucketId: string) => OnlineExperimentBucket | undefined;
  getNegativeSamplesByBucket: (bucketId: string) => NegativeSample[];
  getNegativeSamplesByRecord: (recordId: string) => NegativeSample[];
  getRecordsByBucket: (bucketId: string) => EntityMergeRecord[];
  setSelectedBucketForNegativeFilter: (bucketId: string | null) => void;
  setScrollTarget: (target: ScrollTarget) => void;
  setHighlightBucketId: (bucketId: string | null) => void;
  setHighlightSampleIds: (sampleIds: string[]) => void;
  setDrawerActiveTab: (tab: DrawerTabKey) => void;
  clearLastUpdatedHistoryId: () => void;
  navigateToBucket: (bucketId: string) => void;
  navigateToNegativeSamples: (bucketId: string | null, sampleIds?: string[]) => void;
}

const defaultModelParams: ModelParams = {
  version: 'v2.3.1',
  modelName: 'GAT-Entity-Merge',
  threshold: 0.85,
  embeddingDimension: 256,
  graphLayers: 3,
  tradeOffReason: '平衡准确率与召回率，阈值设为0.85时F1分数最高；256维在当前数据规模下内存占用可控，3层图注意力网络足以捕捉局部结构特征',
  updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
};

export const useAppStore = create<AppState>((set, get) => ({
  buckets: [],
  negativeSamples: [],
  mergeRecords: [],
  viewMode: 'table',
  currentStep: 'import_bucket',
  selectedBucketIds: [],
  selectedRecordId: null,
  currentUser: '林姐',
  selectedNegativeSampleIds: [],
  selectedBucketForNegativeFilter: null,
  scrollTarget: null,
  highlightBucketId: null,
  highlightSampleIds: [],
  drawerActiveTab: 'basic',
  lastUpdatedHistoryId: null,

  importBuckets: (newBuckets) => {
    const state = get();
    const importBatchId = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    const existingBucketIds = new Set(state.buckets.map(b => b.bucketId));
    let added = 0;
    let skipped = 0;

    const bucketsToAdd: OnlineExperimentBucket[] = [];
    newBuckets.forEach(bucket => {
      if (existingBucketIds.has(bucket.bucketId)) {
        skipped++;
      } else {
        bucketsToAdd.push({
          ...bucket,
          id: uuidv4(),
          importTime: now,
          importBatchId,
          importedBy: state.currentUser,
        });
        added++;
        existingBucketIds.add(bucket.bucketId);
      }
    });

    set({
      buckets: [...state.buckets, ...bucketsToAdd],
    });

    return { added, skipped };
  },

  addNegativeSamples: (samples) => {
    const state = get();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const newSamples = samples.map(s => ({
      ...s,
      id: uuidv4(),
      reviewTime: now,
      reviewedBy: s.reviewed ? state.currentUser : undefined,
    }));
    set({ negativeSamples: [...state.negativeSamples, ...newSamples] });
  },

  updateNegativeSampleReview: (sampleId, status, note) => {
    const state = get();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    set({
      negativeSamples: state.negativeSamples.map(s =>
        s.id === sampleId
          ? { ...s, reviewed: true, reviewedBy: state.currentUser, reviewTime: now, reviewStatus: status, reviewNote: note }
          : s
      ),
    });
  },

  updateMergeRemark: (recordId, newRemark, reason) => {
    const state = get();
    const record = state.mergeRecords.find(r => r.id === recordId);
    if (!record) return null;
    if (newRemark === record.remark) return null;

    const historyEntry: VersionHistory = {
      id: uuidv4(),
      entityId: recordId,
      field: 'remark',
      oldValue: record.remark,
      newValue: newRemark,
      modifiedBy: state.currentUser,
      modifiedTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      changeReason: reason,
    };

    set({
      mergeRecords: state.mergeRecords.map(r =>
        r.id === recordId
          ? { ...r, remark: newRemark, versionHistory: [...r.versionHistory, historyEntry] }
          : r
      ),
      drawerActiveTab: 'history',
      lastUpdatedHistoryId: historyEntry.id,
    });

    return historyEntry.id;
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentStep: (step) => set({ currentStep: step }),
  selectBucket: (bucketId) => {
    const state = get();
    if (!state.selectedBucketIds.includes(bucketId)) {
      set({ selectedBucketIds: [...state.selectedBucketIds, bucketId] });
    }
  },
  deselectBucket: (bucketId) => {
    const state = get();
    set({ selectedBucketIds: state.selectedBucketIds.filter(id => id !== bucketId) });
  },
  selectRecord: (recordId) => set({ selectedRecordId: recordId }),
  selectNegativeSample: (sampleId) => {
    const state = get();
    if (!state.selectedNegativeSampleIds.includes(sampleId)) {
      set({ selectedNegativeSampleIds: [...state.selectedNegativeSampleIds, sampleId] });
    }
  },
  deselectNegativeSample: (sampleId) => {
    const state = get();
    set({ selectedNegativeSampleIds: state.selectedNegativeSampleIds.filter(id => id !== sampleId) });
  },

  updateSummary: (recordId, summary) => {
    const state = get();
    set({
      mergeRecords: state.mergeRecords.map(r =>
        r.id === recordId
          ? { ...r, summary: { ...r.summary, ...summary } }
          : r
      ),
    });
  },

  createMergeRecords: () => {
    const state = get();
    const selectedBuckets = state.buckets.filter(b => state.selectedBucketIds.includes(b.bucketId));
    if (selectedBuckets.length === 0) return;

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const bucketIds = selectedBuckets.map(b => b.bucketId);
    
    const relatedSamples = state.negativeSamples.filter(s => bucketIds.includes(s.bucketId));
    const featureMissingSamples = relatedSamples.filter(s => s.featureMissing && s.defaultScoreUsed);
    
    const existingRecordPairs = new Set(state.mergeRecords.map(r => `${r.entityA}-${r.entityB}`));
    
    const mockPairs = [
      { entityA: '品牌A官方旗舰店', entityB: '品牌A官方店', mergedName: '品牌A官方旗舰店', featureMissing: true, missingFeatures: ['店铺等级特征', '历史交易特征'], isDefaultScore: true, mergeScore: 0.75 },
      { entityA: '商品X-2024款', entityB: '商品X新款', mergedName: '商品X-2024新款', featureMissing: false, missingFeatures: [], isDefaultScore: false, mergeScore: 0.92 },
      { entityA: '用户ID_12345', entityB: '用户ID_12345_new', mergedName: '用户ID_12345', featureMissing: true, missingFeatures: ['用户画像标签'], isDefaultScore: true, mergeScore: 0.68 },
      { entityA: '类目_数码手机', entityB: '类目_手机数码', mergedName: '类目_手机数码', featureMissing: false, missingFeatures: [], isDefaultScore: false, mergeScore: 0.88 },
    ];

    const newRecords: EntityMergeRecord[] = [];
    mockPairs.forEach((pair, idx) => {
      const pairKey = `${pair.entityA}-${pair.entityB}`;
      if (existingRecordPairs.has(pairKey)) return;

      const sampleIds = featureMissingSamples.slice(idx * 2, idx * 2 + 2).map(s => s.id);
      
      newRecords.push({
        id: uuidv4(),
        ...pair,
        bucketIds,
        status: pair.featureMissing ? 'reviewing' : 'pending',
        createdBy: state.currentUser,
        createdAt: now,
        remark: '',
        modelParams: defaultModelParams,
        summary: {
          whyKept: pair.featureMissing
            ? `图神经网络计算相似度为${pair.mergeScore.toFixed(2)}，因${pair.missingFeatures.join('、')}特征缺失，使用默认评分阈值0.65，暂保留待推荐负责人复核`
            : `图神经网络计算相似度为${pair.mergeScore.toFixed(2)}，高于阈值${defaultModelParams.threshold}，实体语义高度一致，特征完整`,
          missingMaterials: pair.featureMissing ? pair.missingFeatures : [],
          nextOwner: pair.featureMissing ? 'recommend_owner' : 'data_scientist',
          actionRequired: pair.featureMissing ? '请推荐负责人确认该实体对是否可在特征缺失情况下合并' : '可直接确认合并，或补充备注说明',
        },
        versionHistory: [],
        negativeSampleIds: sampleIds,
      });
    });

    set({
      mergeRecords: [...state.mergeRecords, ...newRecords],
      currentStep: newRecords.length > 0 ? 'review_negative' : 'completed',
    });
  },

  confirmRecord: (recordId) => {
    const state = get();
    set({
      mergeRecords: state.mergeRecords.map(r =>
        r.id === recordId ? { ...r, status: 'confirmed' as const } : r
      ),
    });
  },

  rejectRecord: (recordId) => {
    const state = get();
    set({
      mergeRecords: state.mergeRecords.map(r =>
        r.id === recordId ? { ...r, status: 'rejected' as const } : r
      ),
    });
  },

  getBucketById: (bucketId) => get().buckets.find(b => b.bucketId === bucketId),
  getNegativeSamplesByBucket: (bucketId) => get().negativeSamples.filter(s => s.bucketId === bucketId),
  getNegativeSamplesByRecord: (recordId) => {
    const record = get().mergeRecords.find(r => r.id === recordId);
    if (!record) return [];
    return get().negativeSamples.filter(s => record.negativeSampleIds.includes(s.id));
  },
  getRecordsByBucket: (bucketId) => get().mergeRecords.filter(r => r.bucketIds.includes(bucketId)),

  setSelectedBucketForNegativeFilter: (bucketId) => set({ selectedBucketForNegativeFilter: bucketId }),
  setScrollTarget: (target) => set({ scrollTarget: target }),
  setHighlightBucketId: (bucketId) => set({ highlightBucketId: bucketId }),
  setHighlightSampleIds: (sampleIds) => set({ highlightSampleIds: sampleIds }),
  setDrawerActiveTab: (tab) => set({ drawerActiveTab: tab }),
  clearLastUpdatedHistoryId: () => set({ lastUpdatedHistoryId: null }),

  navigateToBucket: (bucketId) => {
    set({
      scrollTarget: 'bucket',
      highlightBucketId: bucketId,
      selectedBucketForNegativeFilter: null,
      highlightSampleIds: [],
    });
  },

  navigateToNegativeSamples: (bucketId, sampleIds) => {
    set({
      scrollTarget: 'negative',
      selectedBucketForNegativeFilter: bucketId,
      highlightSampleIds: sampleIds || [],
      highlightBucketId: null,
    });
  },
}));
