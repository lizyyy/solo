import type { PlaybackRecord, Anomaly, ExperimentBucket, LayerMetric, VersionHistory, ThresholdItem } from '../types';
import { generateId, formatDateTime, detectAnomalies } from '../utils';

export const currentUser = {
  name: '小孟',
  role: 'operator' as const
};

export const dataScientist = {
  name: '张博士',
  role: 'data_scientist' as const
};

export { createVersionHistory } from '../utils';

const createMockThresholds = () => {
  const raw = [
    { metricName: 'CTR阈值', thresholdValue: 0.05, reportValue: 0.05, isConsistent: true },
    { metricName: 'CVR阈值', thresholdValue: 0.02, reportValue: 0.02, isConsistent: true },
    { metricName: '曝光阈值', thresholdValue: 1000, reportValue: 1000, isConsistent: true },
    { metricName: '点击阈值', thresholdValue: 50, reportValue: 50, isConsistent: true }
  ];
  return detectAnomalies(raw);
};

const createMockAnomalyThresholds = () => {
  const raw = [
    { metricName: 'CTR阈值', thresholdValue: 0.06, reportValue: 0.05, isConsistent: false },
    { metricName: 'CVR阈值', thresholdValue: 0.025, reportValue: 0.02, isConsistent: false },
    { metricName: '曝光阈值', thresholdValue: 1000, reportValue: 1000, isConsistent: true },
    { metricName: '点击阈值', thresholdValue: 50, reportValue: 50, isConsistent: true }
  ];
  return detectAnomalies(raw);
};

export const mockPlaybackRecords: PlaybackRecord[] = [
  {
    id: generateId(),
    noteId: 'NOTE-2024-001',
    fileName: '阈值调参_20240601.json',
    operator: '小孟',
    status: 'normal',
    createdAt: '2024-06-01 10:30:00',
    updatedAt: '2024-06-01 10:30:00',
    currentStep: 'metric',
    hasAnomaly: false,
    thresholds: createMockThresholds(),
    remark: '6月1日常规调参'
  },
  {
    id: generateId(),
    noteId: 'NOTE-2024-002',
    fileName: '阈值调参_20240603.json',
    operator: '小孟',
    status: 'pending_review',
    createdAt: '2024-06-03 14:20:00',
    updatedAt: '2024-06-03 14:20:00',
    currentStep: 'metric',
    hasAnomaly: true,
    thresholds: createMockAnomalyThresholds(),
    remark: '6月3日活动调参，阈值已更新但报告写了旧值'
  },
  {
    id: generateId(),
    noteId: 'NOTE-2024-003',
    fileName: '阈值调参_20240605.json',
    operator: '小孟',
    status: 'modified',
    createdAt: '2024-06-05 09:15:00',
    updatedAt: '2024-06-05 11:00:00',
    currentStep: 'metric',
    hasAnomaly: false,
    thresholds: createMockThresholds(),
    remark: '6月5日调参，已修正备注'
  }
];

export const mockAnomalies: Anomaly[] = [
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[1].id,
    metricName: 'CTR阈值',
    thresholdValue: 0.06,
    reportValue: 0.05,
    detectedAt: '2024-06-03 14:20:00'
  },
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[1].id,
    metricName: 'CVR阈值',
    thresholdValue: 0.025,
    reportValue: 0.02,
    detectedAt: '2024-06-03 14:20:00'
  }
];

export const mockExperimentBuckets: ExperimentBucket[] = [
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[0].id,
    bucketName: '实验桶A-CTR优化',
    bucketUrl: 'https://experiment.example.com/bucket/A-123',
    addedBy: '小孟',
    addedAt: '2024-06-01 10:35:00'
  },
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[1].id,
    bucketName: '实验桶B-大促活动',
    bucketUrl: 'https://experiment.example.com/bucket/B-456',
    addedBy: '小孟',
    addedAt: '2024-06-03 14:25:00'
  }
];

export const mockLayerMetrics: LayerMetric[] = [
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[0].id,
    layerName: '首屏',
    metricName: 'CTR',
    oldValue: 0.045,
    newValue: 0.05,
    updatedBy: '小孟',
    updatedAt: '2024-06-01 10:40:00'
  },
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[0].id,
    layerName: '首屏',
    metricName: 'CVR',
    oldValue: 0.018,
    newValue: 0.02,
    updatedBy: '小孟',
    updatedAt: '2024-06-01 10:40:00'
  }
];

export const mockVersionHistories: VersionHistory[] = [
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[2].id,
    version: 1,
    fieldName: 'remark',
    oldValue: '6月5日调参',
    newValue: '6月5日调参，已修正备注',
    modifiedBy: '小孟',
    modifiedAt: '2024-06-05 11:00:00',
    changeType: 'update'
  },
  {
    id: generateId(),
    playbackId: mockPlaybackRecords[2].id,
    version: 2,
    fieldName: 'thresholds',
    oldValue: '[{"metricName":"CTR阈值","thresholdValue":0.055}]',
    newValue: '[{"metricName":"CTR阈值","thresholdValue":0.05}]',
    modifiedBy: '小孟',
    modifiedAt: '2024-06-05 10:30:00',
    changeType: 'update'
  }
];
