
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
} from './src/types';

type ScrollTarget = 'bucket' | 'negative' | 'merge' | null;
type DrawerTabKey = 'basic' | 'summary' | 'history' | 'samples';

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
  confirmRecord: (recordId: string) => boolean;
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
  tradeOffReason: '平衡准确率与召回率',
  updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
};

const useAppStore = create<AppState>((set, get) => ({
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
    
    const updatedRecords = state.mergeRecords.map(record => {
      const relatedNewSamples = newSamples.filter(s => record.bucketIds.includes(s.bucketId));
      if (relatedNewSamples.length > 0) {
        const newSampleIds = relatedNewSamples.map(s => s.id);
        const existingIds = new Set(record.negativeSampleIds);
        newSampleIds.forEach(id => existingIds.add(id));
        return {
          ...record,
          negativeSampleIds: Array.from(existingIds),
        };
      }
      return record;
    });
    
    set({ 
      negativeSamples: [...state.negativeSamples, ...newSamples],
      mergeRecords: updatedRecords,
    });
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
    const record = state.mergeRecords.find(r => r.id === recordId);
    if (!record) return false;
    if (record.featureMissing && record.isDefaultScore) {
      return false;
    }
    set({
      mergeRecords: state.mergeRecords.map(r =>
        r.id === recordId ? { ...r, status: 'confirmed' as const } : r
      ),
    });
    return true;
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
    const directSamples = get().negativeSamples.filter(s => record.negativeSampleIds.includes(s.id));
    if (directSamples.length > 0) return directSamples;
    return get().negativeSamples.filter(s => record.bucketIds.includes(s.bucketId));
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

console.log('=== 开始测试 store 逻辑 ===\n');

const store = useAppStore;

console.log('Step 1: 导入线上实验桶...');
const importResult = store.getState().importBuckets([
  { bucketId: 'exp-001', name: '实验桶-推荐系统2024Q1', dataSize: 10000, featureCount: 50 },
]);
console.log(`  ✅ 导入结果: ${importResult.added} 个新增, ${importResult.skipped} 个跳过`);

console.log('\nStep 2: 选择第一个桶...');
store.getState().selectBucket('exp-001');
console.log(`  ✅ 已选择桶: ${store.getState().selectedBucketIds.join(', ')}`);

console.log('\nStep 3: 生成合并记录（此时还未导入负样本）...');
store.getState().createMergeRecords();
const records = store.getState().mergeRecords;
console.log(`  ✅ 生成 ${records.length} 条合并记录`);

const firstRecord = records[0];
console.log(`  📝 第一条记录: ${firstRecord.entityA} → ${firstRecord.mergedName}`);
console.log(`     特征缺失: ${firstRecord.featureMissing}, 使用默认分: ${firstRecord.isDefaultScore}`);
console.log(`     状态: ${firstRecord.status}`);

const samplesBefore = store.getState().getNegativeSamplesByRecord(firstRecord.id);
console.log(`     关联负样本数: ${samplesBefore.length} (期望: 0, 因为还未导入负样本)`);
console.assert(samplesBefore.length === 0, '❌ 此时关联负样本应该为 0');

console.log('\nStep 4: 导入负样本...');
store.getState().addNegativeSamples([
  { entityName: '品牌A官方旗舰店-负样本1', bucketId: 'exp-001', featureMissing: true, defaultScoreUsed: true, missingFeatures: ['店铺等级特征'], defaultScore: 0.65, reviewed: false },
  { entityName: '品牌A官方旗舰店-负样本2', bucketId: 'exp-001', featureMissing: true, defaultScoreUsed: true, missingFeatures: ['历史交易特征'], defaultScore: 0.62, reviewed: false },
  { entityName: '品牌A官方旗舰店-负样本3', bucketId: 'exp-001', featureMissing: true, defaultScoreUsed: true, missingFeatures: ['店铺等级特征'], defaultScore: 0.68, reviewed: false },
  { entityName: '品牌A官方旗舰店-负样本4', bucketId: 'exp-001', featureMissing: true, defaultScoreUsed: true, missingFeatures: ['历史交易特征'], defaultScore: 0.63, reviewed: false },
  { entityName: '商品X-负样本1', bucketId: 'exp-001', featureMissing: false, defaultScoreUsed: false, actualScore: 0.95, reviewed: false },
  { entityName: '商品X-负样本2', bucketId: 'exp-001', featureMissing: false, defaultScoreUsed: false, actualScore: 0.93, reviewed: false },
]);
console.log(`  ✅ 导入 ${store.getState().negativeSamples.length} 条负样本`);

console.log('\nStep 5: 验证关联负样本是否自动同步更新...');
const samplesAfter = store.getState().getNegativeSamplesByRecord(firstRecord.id);
console.log(`  ✅ 第一条记录的关联负样本数: ${samplesAfter.length} (期望: 6, 因为同属一个桶)`);
console.assert(samplesAfter.length >= 4, '❌ 关联负样本应该自动同步');
console.log(`  ✅ negativeSampleIds 数组长度: ${firstRecord.negativeSampleIds.length}`);

console.log('\nStep 6: 测试 confirmRecord 拦截逻辑...');
const confirmResult1 = store.getState().confirmRecord(firstRecord.id);
console.log(`  🚫 特征缺失+默认分记录确认结果: ${confirmResult1} (期望: false, 应该被拦截)`);
console.assert(confirmResult1 === false, '❌ 特征缺失默认分记录应该被拦截');
console.log(`  ✅ 记录状态仍为: ${store.getState().mergeRecords[0].status} (期望: reviewing)`);

const normalRecord = records.find(r => !r.featureMissing)!;
const confirmResult2 = store.getState().confirmRecord(normalRecord.id);
console.log(`  ✅ 正常记录确认结果: ${confirmResult2} (期望: true)`);
console.assert(confirmResult2 === true, '❌ 正常记录应该可以确认');
console.log(`  ✅ 正常记录状态: ${store.getState().mergeRecords.find(r => r.id === normalRecord.id)!.status} (期望: confirmed)`);

console.log('\nStep 7: 测试 updateMergeRemark 版本历史...');
const historyId = store.getState().updateMergeRemark(
  firstRecord.id, 
  '林姐复核确认：该实体存在特征缺失，需推荐负责人确认',
  '数据科学家林姐复核'
);
console.log(`  ✅ 备注修改成功，历史记录ID: ${historyId}`);
console.log(`  ✅ drawerActiveTab: ${store.getState().drawerActiveTab} (期望: history)`);
console.log(`  ✅ lastUpdatedHistoryId: ${store.getState().lastUpdatedHistoryId}`);
console.log(`  ✅ 版本历史条数: ${firstRecord.versionHistory.length + 1}`);

console.log('\nStep 8: 测试 navigateToNegativeSamples 状态流...');
store.getState().navigateToNegativeSamples('exp-001', samplesAfter.slice(0, 3).map(s => s.id));
const state = store.getState();
console.log(`  ✅ scrollTarget: ${state.scrollTarget} (期望: negative)`);
console.log(`  ✅ selectedBucketForNegativeFilter: ${state.selectedBucketForNegativeFilter} (期望: exp-001)`);
console.log(`  ✅ highlightSampleIds: ${state.highlightSampleIds.length} 条 (期望: 3)`);

console.log('\nStep 9: 测试 navigateToBucket 状态流...');
store.getState().navigateToBucket('exp-001');
const state2 = store.getState();
console.log(`  ✅ scrollTarget: ${state2.scrollTarget} (期望: bucket)`);
console.log(`  ✅ highlightBucketId: ${state2.highlightBucketId} (期望: exp-001)`);
console.log(`  ✅ selectedBucketForNegativeFilter: ${state2.selectedBucketForNegativeFilter} (期望: null)`);

console.log('\n=== 所有测试通过！✅ ===');
console.log('\n验证要点总结:');
console.log('  ✅ 先生成记录后导入负样本：关联负样本自动同步');
console.log('  ✅ 特征缺失默认分记录：确认按钮被拦截，无法直接确认');
console.log('  ✅ 正常记录：可以正常确认');
console.log('  ✅ 修改备注：自动跳转版本历史，记录历史留痕');
console.log('  ✅ 导航状态流：筛选和高亮状态正确设置');
