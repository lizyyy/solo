import { storage } from '@/utils/storage';
import { generateId, nowISO } from '@/utils/common';
import { Review, TrainingLog, ChangeHistory, ThresholdNote, SummaryItem } from '@/types';

const SAMPLE_LOG_TEXT = `2024-06-01 10:00:01 [INFO] model_v3 auc=0.872 logloss=0.341
2024-06-01 10:00:02 [INFO] feature:user_click_7d count=12453 coverage=0.94
2024-06-01 10:00:03 [WARN] feature:item_price_std missing rate=0.18, used default_score=0.5
2024-06-01 10:00:04 [INFO] feature:user_gender count=9872 coverage=0.98
2024-06-01 10:00:05 [INFO] threshold adjust: ctr_threshold from 0.03 to 0.025
2024-06-01 10:00:06 [WARN] feature:category_click_rate missing rate=0.12, used default_score=0.3
2024-06-01 10:00:07 [INFO] model_v3 precision@5=0.42 recall@5=0.31
2024-06-01 10:00:08 [INFO] training step 1000 loss=0.287
2024-06-01 10:00:09 [INFO] training step 2000 loss=0.254
2024-06-01 10:00:10 [INFO] training step 3000 loss=0.231`;

export function initMockData(): void {
  if (storage.getReviews().length > 0) {
    return;
  }

  const now = nowISO();

  const review1: Review = {
    id: generateId(),
    title: '2024-06-01 推荐模型特征缓存失效复盘',
    status: 'pending_review',
    currentStep: 'summary_update',
    createdBy: '算法工程师-小乔',
    createdAt: now,
    updatedAt: now,
    assignee: '推荐负责人-老王',
    hasDefaultScoreIssue: true,
  };

  const review2: Review = {
    id: generateId(),
    title: '2024-05-28 用户画像特征对齐复盘',
    status: 'in_progress',
    currentStep: 'threshold_note',
    createdBy: '算法工程师-小乔',
    createdAt: now,
    updatedAt: now,
    assignee: '算法工程师-小乔',
    hasDefaultScoreIssue: false,
  };

  const review3: Review = {
    id: generateId(),
    title: '2024-05-20 冷启动推荐效果复盘',
    status: 'completed',
    currentStep: 'summary_update',
    createdBy: '算法工程师-小乔',
    createdAt: now,
    updatedAt: now,
    assignee: '推荐负责人-老王',
    hasDefaultScoreIssue: false,
    reviewComment: '数据完整，结论可信，已归档',
  };

  storage.setReviews([review1, review2, review3]);

  const logLines = SAMPLE_LOG_TEXT.split('\n').filter(l => l.trim());
  const trainingLogs1: TrainingLog[] = logLines.map((line, idx) => ({
    id: generateId(),
    reviewId: review1.id,
    originalLineNumber: idx + 1,
    content: line.trim(),
    originalContent: line.trim(),
    status: idx === 2 ? 'modified' : 'original',
    sourceHash: `mock_${review1.id}_${idx}`,
    isModified: idx === 2,
    modifiedBy: idx === 2 ? '算法工程师-小乔' : undefined,
    modifiedAt: idx === 2 ? now : undefined,
  }));

  trainingLogs1[2].content = '2024-06-01 10:00:03 [WARN] feature:item_price_std missing rate=0.18, used default_score=0.5 (已确认：属于缓存失效导致)';

  const trainingLogs2: TrainingLog[] = [
    {
      id: generateId(),
      reviewId: review2.id,
      originalLineNumber: 1,
      content: '2024-05-28 09:00:00 [INFO] user_age feature coverage=0.85',
      originalContent: '2024-05-28 09:00:00 [INFO] user_age feature coverage=0.85',
      status: 'original',
      sourceHash: `mock_${review2.id}_1`,
      isModified: false,
    },
    {
      id: generateId(),
      reviewId: review2.id,
      originalLineNumber: 2,
      content: '2024-05-28 09:00:01 [INFO] user_level feature alignment rate=0.92',
      originalContent: '2024-05-28 09:00:01 [INFO] user_level feature alignment rate=0.92',
      status: 'original',
      sourceHash: `mock_${review2.id}_2`,
      isModified: false,
    },
  ];

  storage.setTrainingLogs([...trainingLogs1, ...trainingLogs2]);

  const history1: ChangeHistory = {
    id: generateId(),
    reviewId: review1.id,
    fieldName: 'training_log[3]',
    oldValue: '2024-06-01 10:00:03 [WARN] feature:item_price_std missing rate=0.18, used default_score=0.5',
    newValue: '2024-06-01 10:00:03 [WARN] feature:item_price_std missing rate=0.18, used default_score=0.5 (已确认：属于缓存失效导致)',
    modifiedBy: '算法工程师-小乔',
    modifiedAt: now,
    changeType: 'update',
  };

  const history2: ChangeHistory = {
    id: generateId(),
    reviewId: review1.id,
    fieldName: 'currentStep',
    oldValue: 'threshold_note',
    newValue: 'summary_update',
    modifiedBy: '算法工程师-小乔',
    modifiedAt: now,
    changeType: 'update',
  };

  storage.setChangeHistories([history1, history2]);

  const note1: ThresholdNote = {
    id: generateId(),
    reviewId: review1.id,
    title: 'item_price_std 阈值调参记录',
    content: '该特征阈值原设置为 missing_rate < 0.1 时使用，超过时降级为均值填充。\n本次发现缓存失效导致 missing_rate 达到 0.18，触发了默认分机制。\n建议方案：1) 修复缓存失效问题；2) 提高阈值容错率到 0.2。',
    relatedLogIds: [trainingLogs1[2].id],
    createdBy: '算法工程师-小乔',
    createdAt: now,
  };

  storage.setThresholdNotes([note1]);

  const summary1: SummaryItem = {
    id: generateId(),
    reviewId: review1.id,
    content: '特征缓存失效导致 item_price_std 缺失率上升到 18%，触发默认分机制',
    source: 'training_log',
    needsConfirmation: true,
    isConfirmed: false,
  };

  const summary2: SummaryItem = {
    id: generateId(),
    reviewId: review1.id,
    content: '建议将 missing_rate 阈值从 0.1 调整到 0.2，提高容错率',
    source: 'threshold_note',
    needsConfirmation: true,
    isConfirmed: false,
  };

  const summary3: SummaryItem = {
    id: generateId(),
    reviewId: review1.id,
    content: '模型整体 AUC 0.872，未受明显影响，但需要修复缓存问题',
    source: 'manual',
    needsConfirmation: false,
    isConfirmed: true,
    confirmedBy: '算法工程师-小乔',
    confirmedAt: now,
  };

  const summary4: SummaryItem = {
    id: generateId(),
    reviewId: review3.id,
    content: '冷启动阶段新物品曝光量提升 23%，点击率下降 4%，在预期范围内',
    source: 'training_log',
    needsConfirmation: false,
    isConfirmed: true,
    confirmedBy: '推荐负责人-老王',
    confirmedAt: now,
  };

  storage.setSummaryItems([summary1, summary2, summary3, summary4]);
}
