import type { CheckRecord } from '@/types';

const generateCurveData = (seed: number, count: number = 20) => {
  const data = [];
  let loss = 2.5 + seed * 0.3;
  let accuracy = 0.5 + seed * 0.05;
  for (let i = 1; i <= count; i++) {
    loss = Math.max(0.1, loss - (0.1 + Math.random() * 0.08));
    accuracy = Math.min(0.98, accuracy + (0.015 + Math.random() * 0.01));
    data.push({
      epoch: i,
      loss: Number(loss.toFixed(4)),
      accuracy: Number(accuracy.toFixed(4)),
    });
  }
  return data;
};

export const mockRecords: CheckRecord[] = [
  {
    id: 'rec-001',
    title: '用户行为特征_202406_batch001',
    type: 'smooth',
    status: 'completed',
    currentStep: 'update_version',
    batchId: 'batch-20240601-001',
    featureName: 'user_behavior_7d',
    createTime: '2024-06-01 10:30:00',
    updateTime: '2024-06-01 14:20:00',
    steps: [
      { key: 'import_log', label: '导入训练日志曲线', status: 'completed' },
      { key: 'review_notes', label: '补看阈值调参笔记', status: 'completed' },
      { key: 'update_version', label: '更新特征版本表', status: 'completed' },
    ],
    trainingLog: {
      id: 'log-001',
      batchId: 'batch-20240601-001',
      curveData: generateCurveData(0),
      importTime: '2024-06-01 10:30:00',
      isDuplicate: false,
    },
    thresholdNote: {
      id: 'note-001',
      version: 'v2.3.1',
      content: '阈值调参说明：本次使用新口径，正负样本比例1:10，learning_rate=0.001，batch_size=256。训练20轮后收敛稳定，AUC达到0.87。',
      updateTime: '2024-06-01 11:00:00',
      operator: '小乔',
      isOldCaliber: false,
    },
    featureVersions: [
      {
        version: 'v2.3.1',
        featureName: 'user_behavior_7d',
        caliber: '新口径：近7天活跃行为，含点击/收藏/加购',
        updateTime: '2024-06-01 14:20:00',
        operator: '小乔',
        remark: '特征一致性检查通过，批流结果一致',
      },
      {
        version: 'v2.3.0',
        featureName: 'user_behavior_7d',
        caliber: '新口径：近7天活跃行为，含点击/收藏/加购',
        updateTime: '2024-05-28 09:15:00',
        operator: '小乔',
        remark: '初始版本',
      },
    ],
    conflicts: [],
    reviewHistory: [
      { operator: '小乔', action: '导入训练日志', time: '2024-06-01 10:30:00', remark: '' },
      { operator: '小乔', action: '补看阈值调参笔记', time: '2024-06-01 11:05:00', remark: '参数核对无误' },
      { operator: '小乔', action: '更新特征版本表', time: '2024-06-01 14:20:00', remark: '版本v2.3.1发布' },
    ],
  },
  {
    id: 'rec-002',
    title: '商品转化率特征_202406_batch003',
    type: 'duplicate_training',
    status: 'pending_review',
    currentStep: 'import_log',
    batchId: 'batch-20240603-003',
    featureName: 'item_conversion_1d',
    createTime: '2024-06-03 16:45:00',
    updateTime: '2024-06-03 17:10:00',
    steps: [
      { key: 'import_log', label: '导入训练日志曲线', status: 'blocked', blockedReason: '检测到同一批数据重复训练两次，请策略产品复核' },
      { key: 'review_notes', label: '补看阈值调参笔记', status: 'pending' },
      { key: 'update_version', label: '更新特征版本表', status: 'pending' },
    ],
    trainingLog: {
      id: 'log-002',
      batchId: 'batch-20240603-003',
      curveData: generateCurveData(1),
      importTime: '2024-06-03 16:45:00',
      isDuplicate: true,
      duplicateOf: 'batch-20240603-003',
    },
    thresholdNote: {
      id: 'note-002',
      version: 'v1.8.0',
      content: '阈值调参说明：正负样本比例1:5，learning_rate=0.002，batch_size=128。',
      updateTime: '2024-06-03 16:00:00',
      operator: '小乔',
      isOldCaliber: false,
    },
    featureVersions: [
      {
        version: 'v1.8.0',
        featureName: 'item_conversion_1d',
        caliber: '商品24小时转化率',
        updateTime: '2024-06-03 15:30:00',
        operator: '小乔',
        remark: '同日相同批次已训练过一次（15:30），本次为第二次训练（16:45）',
      },
    ],
    conflicts: [],
    reviewHistory: [
      { operator: '小乔', action: '导入训练日志', time: '2024-06-03 16:45:00', remark: '批次batch-20240603-003第二次导入' },
      { operator: '系统', action: '检测异常', time: '2024-06-03 16:45:10', remark: '同一批数据重复训练两次，标记待策略产品复核' },
    ],
  },
  {
    id: 'rec-003',
    title: '用户留存特征_202405_batch012',
    type: 'old_caliber',
    status: 'conflict',
    currentStep: 'review_notes',
    batchId: 'batch-20240520-012',
    featureName: 'user_retention_30d',
    createTime: '2024-05-20 09:00:00',
    updateTime: '2024-06-02 11:30:00',
    steps: [
      { key: 'import_log', label: '导入训练日志曲线', status: 'completed' },
      { key: 'review_notes', label: '补看阈值调参笔记', status: 'blocked', blockedReason: '训练日志与阈值调参笔记存在冲突' },
      { key: 'update_version', label: '更新特征版本表', status: 'pending' },
    ],
    trainingLog: {
      id: 'log-003',
      batchId: 'batch-20240520-012',
      curveData: generateCurveData(2),
      importTime: '2024-05-20 09:00:00',
      isDuplicate: false,
    },
    thresholdNote: {
      id: 'note-003',
      version: 'v3.1.0',
      content: '【旧口径补录】阈值调参说明：使用旧口径统计，正负样本比例1:8，learning_rate=0.005，batch_size=512。注意：此为5月份历史笔记，当时使用的是旧留存定义（注册后30天登录）。',
      updateTime: '2024-06-02 11:00:00',
      operator: '小乔',
      isOldCaliber: true,
    },
    featureVersions: [
      {
        version: 'v3.0.0',
        featureName: 'user_retention_30d',
        caliber: '新口径：首访后30天内有任意活跃行为',
        updateTime: '2024-06-01 10:00:00',
        operator: '小乔',
        remark: '口径切换版本',
      },
      {
        version: 'v2.9.0',
        featureName: 'user_retention_30d',
        caliber: '旧口径：注册后30天内登录',
        updateTime: '2024-05-20 14:00:00',
        operator: '小乔',
        remark: '历史版本，已废弃',
      },
    ],
    conflicts: [
      {
        id: 'conflict-001',
        type: 'log_vs_note',
        description: '训练日志使用新口径计算留存，但阈值调参笔记标注为旧口径',
        logEvidence: '训练日志中特征口径标识为"新口径：首访后30天"，AUC曲线在第15轮后稳定在0.82',
        noteEvidence: '阈值调参笔记明确标注"【旧口径补录】"，使用旧留存定义（注册后30天登录），该口径已于6月1日废弃',
        resolution: null,
      },
    ],
    reviewHistory: [
      { operator: '小乔', action: '导入训练日志', time: '2024-05-20 09:00:00', remark: '5月批次数据导入' },
      { operator: '小乔', action: '补看阈值调参笔记', time: '2024-06-02 11:30:00', remark: '从历史调参笔记补录，发现口径不一致' },
      { operator: '系统', action: '检测冲突', time: '2024-06-02 11:30:05', remark: '日志与笔记口径冲突，请算法工程师确认或驳回' },
    ],
  },
];
