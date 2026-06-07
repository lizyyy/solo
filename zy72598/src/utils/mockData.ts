import type { Experiment, TrainingLog, ParamNote, Summary, Conflict, HistoryRecord } from '@/types';

const now = new Date().toISOString();

export const mockExperiments: Experiment[] = [
  {
    id: 'exp-001',
    name: '多目标排序实验-正常版',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'exp-002',
    name: '多目标排序实验-错口径版',
    status: 'conflicts_found',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'exp-003',
    name: '多目标排序实验-补录版',
    status: 'ready',
    createdAt: now,
    updatedAt: now,
  },
];

const generateCurveData = (baseMetrics: string[], epochs: number = 20) => {
  const data: Array<{ epoch: number; metric: string; value: number }> = [];
  for (let epoch = 1; epoch <= epochs; epoch++) {
    baseMetrics.forEach((metric) => {
      const baseValue = metric.includes('loss') ? 0.8 - epoch * 0.02 : 0.5 + epoch * 0.015;
      const noise = (Math.random() - 0.5) * 0.05;
      data.push({
        epoch,
        metric,
        value: Math.max(0, Math.min(1, baseValue + noise)),
      });
    });
  }
  return data;
};

export const mockTrainingLogs: Record<string, TrainingLog> = {
  'exp-001': {
    id: 'log-001',
    experimentId: 'exp-001',
    curveData: generateCurveData(['ctr_loss', 'cvr_loss', 'total_loss', 'auc_score']),
    features: [
      { name: 'user_click_history_7d', present: true },
      { name: 'item_popularity', present: true },
      { name: 'context_time_slot', present: true },
      { name: 'user_ctr_30d', present: true },
    ],
    hasDefaultScores: false,
    importedAt: now,
  },
  'exp-002': {
    id: 'log-002',
    experimentId: 'exp-002',
    curveData: generateCurveData(['ctr_loss', 'cvr_loss', 'total_loss', 'auc_score']),
    features: [
      { name: 'user_click_history_7d', present: true },
      { name: 'item_popularity', present: true },
      { name: 'context_time_slot', present: false, defaultValue: 0.5 },
      { name: 'user_ctr_30d', present: false, defaultValue: 0.3 },
    ],
    hasDefaultScores: true,
    importedAt: now,
  },
  'exp-003': {
    id: 'log-003',
    experimentId: 'exp-003',
    curveData: generateCurveData(['ctr_loss', 'cvr_loss', 'total_loss', 'auc_score']),
    features: [
      { name: 'user_click_history_7d', present: true },
      { name: 'item_popularity', present: true },
      { name: 'context_time_slot', present: true },
      { name: 'user_ctr_30d', present: true },
    ],
    hasDefaultScores: false,
    importedAt: now,
  },
};

export const mockParamNotes: Record<string, ParamNote> = {
  'exp-001': {
    id: 'note-001',
    experimentId: 'exp-001',
    thresholds: [
      { metric: 'ctr_weight', value: 0.4, note: '点击率权重' },
      { metric: 'cvr_weight', value: 0.3, note: '转化率权重' },
      { metric: 'stay_weight', value: 0.3, note: '停留时长权重' },
    ],
    notes: '正常实验记录：各指标权重平衡，ctr和cvr目标都达标。',
    recordedAt: now,
  },
  'exp-002': {
    id: 'note-002',
    experimentId: 'exp-002',
    thresholds: [
      { metric: 'ctr_weight', value: 0.6, note: '点击率权重调高' },
      { metric: 'cvr_weight', value: 0.2, note: '转化率权重调低' },
      { metric: 'stay_weight', value: 0.2, note: '停留时长权重调低' },
    ],
    notes: '错口径实验：日志曲线显示cvr_loss下降明显，但笔记中cvr权重被调低，存在矛盾。',
    recordedAt: now,
  },
  'exp-003': {
    id: 'note-003',
    experimentId: 'exp-003',
    thresholds: [
      { metric: 'ctr_weight', value: 0.35, note: '点击率权重' },
      { metric: 'cvr_weight', value: 0.35, note: '转化率权重' },
      { metric: 'stay_weight', value: 0.3, note: '停留时长权重' },
    ],
    notes: '补录实验：初始录入时未记录完整，后补充了特征说明。',
    recordedAt: now,
  },
};

export const mockSummaries: Record<string, Summary[]> = {
  'exp-001': [
    {
      id: 'sum-001',
      experimentId: 'exp-001',
      content: '本实验通过多目标排序权衡，在点击率(CTR)、转化率(CVR)和停留时长三个目标间取得平衡。训练曲线显示各loss稳步下降，AUC达到0.78。阈值设置合理，各特征均正常可用。',
      metrics: { final_auc: 0.78, ctr_loss: 0.32, cvr_loss: 0.28, total_loss: 0.60 },
      version: 1,
      createdAt: now,
    },
  ],
  'exp-002': [
    {
      id: 'sum-002',
      experimentId: 'exp-002',
      content: '本实验侧重点击率优化，但注意到训练日志中cvr_loss下降与调参笔记中cvr权重调低存在不一致。同时存在线上特征缺失使用默认分的情况，需推荐负责人复核。',
      metrics: { final_auc: 0.72, ctr_loss: 0.25, cvr_loss: 0.35, total_loss: 0.60 },
      version: 1,
      createdAt: now,
    },
  ],
  'exp-003': [
    {
      id: 'sum-003-v1',
      experimentId: 'exp-003',
      content: '初始版本：实验数据导入，待补充调参笔记。',
      metrics: { final_auc: 0.75, ctr_loss: 0.30, cvr_loss: 0.30, total_loss: 0.60 },
      version: 1,
      createdAt: now,
    },
    {
      id: 'sum-003-v2',
      experimentId: 'exp-003',
      content: '补录版本：补充调参笔记后重新生成摘要。多目标排序取得较好平衡，三个指标均达到预期。',
      metrics: { final_auc: 0.76, ctr_loss: 0.29, cvr_loss: 0.29, total_loss: 0.58 },
      version: 2,
      createdAt: now,
    },
  ],
};

export const mockConflicts: Record<string, Conflict[]> = {
  'exp-002': [
    {
      id: 'conf-001',
      experimentId: 'exp-002',
      type: 'log_vs_note',
      description: '训练日志显示cvr_loss持续下降，但调参笔记中cvr权重被调低至0.2',
      evidence: {
        log: 'cvr_loss从0.8降至0.35，下降趋势明显',
        note: 'cvr_weight设置为0.2，低于正常水平',
      },
      status: 'pending',
    },
    {
      id: 'conf-002',
      experimentId: 'exp-002',
      type: 'feature_missing',
      description: '线上特征缺失，context_time_slot和user_ctr_30d使用默认分',
      evidence: {
        log: '检测到2个特征缺失，使用默认值0.5和0.3',
        note: '笔记中未提及特征缺失情况',
      },
      status: 'pending',
    },
  ],
};

export const mockHistory: Record<string, HistoryRecord[]> = {
  'exp-001': [
    {
      id: 'hist-001',
      experimentId: 'exp-001',
      action: '创建实验',
      operator: '阿越',
      timestamp: now,
      details: { experimentName: '多目标排序实验-正常版' },
    },
    {
      id: 'hist-002',
      experimentId: 'exp-001',
      action: '导入训练日志',
      operator: '阿越',
      timestamp: now,
      details: { logId: 'log-001', featuresCount: 4 },
    },
    {
      id: 'hist-003',
      experimentId: 'exp-001',
      action: '录入调参笔记',
      operator: '阿越',
      timestamp: now,
      details: { noteId: 'note-001' },
    },
    {
      id: 'hist-004',
      experimentId: 'exp-001',
      action: '生成可解释摘要',
      operator: '系统',
      timestamp: now,
      details: { summaryId: 'sum-001', version: 1 },
    },
    {
      id: 'hist-005',
      experimentId: 'exp-001',
      action: '执行自检',
      operator: '系统',
      timestamp: now,
      details: { allPassed: true },
    },
  ],
  'exp-002': [
    {
      id: 'hist-006',
      experimentId: 'exp-002',
      action: '创建实验',
      operator: '阿越',
      timestamp: now,
      details: { experimentName: '多目标排序实验-错口径版' },
    },
    {
      id: 'hist-007',
      experimentId: 'exp-002',
      action: '导入训练日志',
      operator: '阿越',
      timestamp: now,
      details: { logId: 'log-002', featuresCount: 4, hasDefaultScores: true },
    },
    {
      id: 'hist-008',
      experimentId: 'exp-002',
      action: '录入调参笔记',
      operator: '阿越',
      timestamp: now,
      details: { noteId: 'note-002' },
    },
    {
      id: 'hist-009',
      experimentId: 'exp-002',
      action: '检测到冲突',
      operator: '系统',
      timestamp: now,
      details: { conflictsCount: 2 },
    },
  ],
  'exp-003': [
    {
      id: 'hist-010',
      experimentId: 'exp-003',
      action: '创建实验',
      operator: '阿越',
      timestamp: now,
      details: { experimentName: '多目标排序实验-补录版' },
    },
    {
      id: 'hist-011',
      experimentId: 'exp-003',
      action: '导入训练日志',
      operator: '阿越',
      timestamp: now,
      details: { logId: 'log-003' },
    },
    {
      id: 'hist-012',
      experimentId: 'exp-003',
      action: '生成初始摘要v1',
      operator: '系统',
      timestamp: now,
      details: { summaryId: 'sum-003-v1', version: 1 },
    },
    {
      id: 'hist-013',
      experimentId: 'exp-003',
      action: '补录调参笔记',
      operator: '阿越',
      timestamp: now,
      details: { noteId: 'note-003' },
    },
    {
      id: 'hist-014',
      experimentId: 'exp-003',
      action: '补录后重算摘要v2',
      operator: '系统',
      timestamp: now,
      details: { summaryId: 'sum-003-v2', version: 2 },
    },
  ],
};
