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
      content:
        '阈值调参说明：本次使用新口径，正负样本比例1:10，learning_rate=0.001，batch_size=256。训练20轮后收敛稳定，AUC达到0.87。',
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
        remark: '对应审核历史第3步：更新特征版本表；批流一致性检查通过',
      },
      {
        version: 'v2.3.0',
        featureName: 'user_behavior_7d',
        caliber: '新口径：近7天活跃行为，含点击/收藏/加购',
        updateTime: '2024-05-28 09:15:00',
        operator: '小乔',
        remark: '历史基线版本，口径一致',
      },
    ],
    conflicts: [],
    reviewHistory: [
      {
        operator: '小乔',
        action: '第一步：导入训练日志',
        time: '2024-06-01 10:30:00',
        remark: '批次 batch-20240601-001，共20轮，Loss最终 0.1872，Accuracy 0.8541',
      },
      {
        operator: '小乔',
        action: '第二步：补看阈值调参笔记（无冲突）',
        time: '2024-06-01 11:05:00',
        remark:
          '核对笔记 v2.3.1：参数 learning_rate=0.001/batch_size=256 与日志一致，口径与当前线上一致，无冲突',
      },
      {
        operator: '小乔',
        action: '第三步：更新特征版本表',
        time: '2024-06-01 14:20:00',
        remark: '发布 v2.3.1（由 v2.3.0 递增），口径不变；对账：历史3步=版本表2条，对齐',
      },
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
      {
        key: 'import_log',
        label: '导入训练日志曲线',
        status: 'blocked',
        blockedReason: '检测到同一批数据重复训练两次，请策略产品复核后再推进',
      },
      { key: 'review_notes', label: '补看阈值调参笔记', status: 'pending' },
      { key: 'update_version', label: '更新特征版本表', status: 'pending' },
    ],
    trainingLog: {
      id: 'log-002',
      batchId: 'batch-20240603-003',
      curveData: generateCurveData(1),
      importTime: '2024-06-03 16:45:00',
      isDuplicate: true,
      duplicateOf: 'batch-20240603-003（15:30 首次训练记录）',
    },
    thresholdNote: {
      id: 'note-002',
      version: 'v1.8.0',
      content:
        '阈值调参说明：正负样本比例1:5，learning_rate=0.002，batch_size=128。商品24小时转化率特征。',
      updateTime: '2024-06-03 16:00:00',
      operator: '小乔',
      isOldCaliber: false,
    },
    featureVersions: [
      {
        version: 'v1.8.0',
        featureName: 'item_conversion_1d',
        caliber: '商品24小时转化率（曝光→下单）',
        updateTime: '2024-06-03 15:30:00',
        operator: '小乔',
        remark:
          '对账说明：此版本对应 15:30 首次训练（审核历史第1步）；当前16:45为第二次导入，尚未经策略产品复核，暂不新增版本',
      },
      {
        version: 'v1.7.9',
        featureName: 'item_conversion_1d',
        caliber: '商品24小时转化率（曝光→下单）',
        updateTime: '2024-06-02 10:00:00',
        operator: '小乔',
        remark: '历史基线',
      },
    ],
    conflicts: [],
    reviewHistory: [
      {
        operator: '小乔',
        action: '第一步（第一次）：导入训练日志 @15:30',
        time: '2024-06-03 15:30:00',
        remark: '批次 batch-20240603-003 首次导入，对应特征版本表 v1.8.0 的创建时间',
      },
      {
        operator: '小乔',
        action: '第一步（第二次）：再次导入相同批次 @16:45',
        time: '2024-06-03 16:45:00',
        remark:
          '系统比对批次ID batch-20240603-003，发现与 15:30 记录完全一致，判定为重复训练',
      },
      {
        operator: '系统',
        action: '阻断流程 + 标记待复核',
        time: '2024-06-03 16:45:10',
        remark:
          '同一批数据重复训练两次，不自动归为正常；对账：历史3条=版本表2条（v1.8.0 对应首次训练，第二次尚未入账），待策略产品复核后决定是否发布新版本',
      },
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
      {
        key: 'review_notes',
        label: '补看阈值调参笔记',
        status: 'blocked',
        blockedReason: '训练日志与阈值调参笔记口径冲突，请人工确认或驳回',
      },
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
      version: 'v2.9.0（旧口径，6月1日已切换为 v3.0.0 新口径）',
      content:
        '【旧口径补录-5月历史笔记】阈值调参说明：使用旧口径统计30日留存，正负样本比例1:8，learning_rate=0.005，batch_size=512。\n注意：当时留存定义=「注册后30天登录」；2024-06-01起线上改为「首访后30天任意活跃」。\n本次补录发现：日志跑的是新口径，但笔记来自旧口径归档。',
      updateTime: '2024-06-02 11:00:00',
      operator: '小乔',
      isOldCaliber: true,
    },
    featureVersions: [
      {
        version: 'v3.0.0',
        featureName: 'user_retention_30d',
        caliber: '新口径：首访后30天内有任意活跃行为（6月1日起线上口径）',
        updateTime: '2024-06-01 10:00:00',
        operator: '小乔',
        remark:
          '对账：对应审核历史第3步（6月1日口径切换），与日志一致，与当前笔记（旧v2.9.0）冲突，待小乔裁决',
      },
      {
        version: 'v2.9.0',
        featureName: 'user_retention_30d',
        caliber: '旧口径：注册后30天内登录（5月使用，6月1日废弃）',
        updateTime: '2024-05-20 14:00:00',
        operator: '小乔',
        remark:
          '对账：对应审核历史第2步（5月20日），与阈值调参笔记一致，与当前训练日志（新口径）冲突',
      },
    ],
    conflicts: [
      {
        id: 'conflict-001',
        type: 'log_vs_note',
        description:
          '训练日志（新口径） vs 阈值调参笔记（旧口径）：留存定义不一致',
        logEvidence:
          '日志特征口径标识=「新口径：首访后30天任意活跃」，曲线在epoch=15后稳定AUC≈0.82；对齐特征版本表 v3.0.0',
        noteEvidence:
          '笔记明确标注「【旧口径补录】」，留存定义=「注册后30天登录」；此定义与特征版本表 v2.9.0 一致，但该版本已于6月1日被 v3.0.0 取代',
        resolution: null,
      },
    ],
    reviewHistory: [
      {
        operator: '小乔',
        action: '第一步：导入训练日志（5月批次，6月2日补查）',
        time: '2024-05-20 09:00:00',
        remark:
          '批次 batch-20240520-012，训练使用线上新口径；对账：日志 ↔ 版本表 v3.0.0 口径吻合 ✓',
      },
      {
        operator: '小乔',
        action: '第二步-动作1：从阈值调参笔记库补录5月笔记',
        time: '2024-06-02 11:00:00',
        remark:
          '加载归档笔记 v2.9.0，发现记载为旧口径（注册后30天登录）；对账：笔记 ↔ 版本表 v2.9.0 口径吻合 ✓',
      },
      {
        operator: '系统',
        action: '第二步-动作2：自动对账检测 → 发现冲突',
        time: '2024-06-02 11:30:05',
        remark:
          '三方对账：日志→v3.0.0新口径，笔记→v2.9.0旧口径，版本表同时存在两个口径记录 → 判定口径冲突，禁止自动推进；请小乔「确认」（按新口径走）或「驳回」（退回重查笔记）',
      },
    ],
  },
];
