import { ThresholdNote, ExperimentRecord, AnomalySample, HistoryRecord } from '@/types';

const now = new Date();
const formatTime = (d: Date) => d.toISOString();

const timeOffset = (minutes: number) => {
  const d = new Date(now.getTime() - minutes * 60000);
  return formatTime(d);
};

export const initialThresholdNotes: ThresholdNote[] = [
  {
    id: 'note-001',
    batchId: 'BATCH-2024-0601',
    threshold: 0.65,
    wakeRate: 92.5,
    falseAlarmRate: 0.3,
    timeWindowStart: '2024-06-01 08:00:00',
    timeWindowEnd: '2024-06-01 10:00:00',
    crossesTimeWindow: false,
    status: 'normal',
    createdAt: timeOffset(120),
    operator: '小孟',
    source: 'import',
  },
];

export const initialExperiments: ExperimentRecord[] = [
  {
    id: 'exp-001',
    experimentName: '语音唤醒阈值实验_v2.1',
    caliberVersion: 'v2.1',
    threshold: 0.60,
    wakeRate: 95.8,
    falseAlarmRate: 0.15,
    isOldCaliber: false,
    imported: false,
    createdAt: timeOffset(300),
    description: '新口径下的阈值测试，跨时间窗数据需注意',
  },
  {
    id: 'exp-002',
    experimentName: '语音唤醒阈值实验_v1.0',
    caliberVersion: 'v1.0',
    threshold: 0.70,
    wakeRate: 89.2,
    falseAlarmRate: 0.25,
    isOldCaliber: true,
    imported: false,
    createdAt: timeOffset(1440),
    description: '旧口径基准数据，可用于对比参考',
  },
  {
    id: 'exp-003',
    experimentName: '低误唤醒专项测试',
    caliberVersion: 'v2.0',
    threshold: 0.75,
    wakeRate: 86.5,
    falseAlarmRate: 0.1,
    isOldCaliber: false,
    imported: false,
    createdAt: timeOffset(720),
    description: '针对低误唤醒场景优化的阈值',
  },
];

export const initialAnomalies: AnomalySample[] = [];

export const initialHistory: HistoryRecord[] = [
  {
    id: 'hist-001',
    action: '系统初始化',
    operator: '系统',
    targetId: 'system',
    targetType: 'note',
    detail: '演示系统初始化完成，加载默认样本数据',
    timestamp: timeOffset(180),
  },
];

export const sampleNormalNote: ThresholdNote = {
  id: 'note-sample-normal',
  batchId: 'BATCH-DEMO-NORMAL',
  threshold: 0.65,
  wakeRate: 92.5,
  falseAlarmRate: 0.3,
  timeWindowStart: '2024-06-01 08:00:00',
  timeWindowEnd: '2024-06-01 10:00:00',
  crossesTimeWindow: false,
  status: 'normal',
  createdAt: timeOffset(100),
  operator: '小孟',
  source: 'import',
};

export const sampleTimeWindowNote: ThresholdNote = {
  id: 'note-sample-tw',
  batchId: 'BATCH-DEMO-TW',
  threshold: 0.60,
  wakeRate: 95.8,
  falseAlarmRate: 0.15,
  timeWindowStart: '2024-06-01 09:30:00',
  timeWindowEnd: '2024-06-01 11:30:00',
  crossesTimeWindow: true,
  status: 'pending_review',
  createdAt: timeOffset(90),
  operator: '小孟',
  source: 'import',
};

export const sampleOldCaliberNote: ThresholdNote = {
  id: 'note-sample-old',
  batchId: 'BATCH-DEMO-OLD',
  threshold: 0.70,
  wakeRate: 89.2,
  falseAlarmRate: 0.25,
  timeWindowStart: '2024-05-15 08:00:00',
  timeWindowEnd: '2024-05-15 10:00:00',
  crossesTimeWindow: false,
  status: 'old_caliber',
  createdAt: timeOffset(80),
  operator: '小孟',
  source: 'experiment',
  caliberVersion: 'v1.0',
};

export const demoDataBundle = {
  normalNote: sampleNormalNote,
  timeWindowNote: sampleTimeWindowNote,
  oldCaliberNote: sampleOldCaliberNote,
};
