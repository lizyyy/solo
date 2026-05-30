import { Anomaly, ConflictLog } from '../types/anomalies';

export const mockAnomalies: Anomaly[] = [
  {
    id: 'anom_001',
    type: 'wrong_direction',
    severity: 'high',
    location: '1号线扶梯3号',
    zoneId: 'escalator_group_a',
    startTime: '07:45',
    endTime: '08:15',
    peakData: { passengerCount: 45, directionContrast: 0.8 },
    status: 'resolved',
    evidence: [
      { source: 'escalator_sensor', data: { direction: 'down' }, timestamp: '07:45', confidence: 0.95 },
      { source: 'scheduled_config', data: { expectedDirection: 'up' }, timestamp: '07:45', confidence: 1.0 },
    ],
    resolutionNotes: '已人工调整方向为上行，早高峰结束后恢复',
  },
  {
    id: 'anom_002',
    type: 'over_capacity',
    severity: 'high',
    location: '主站厅',
    zoneId: 'concourse_main',
    startTime: '08:05',
    peakData: { count: 980, capacity: 800, percentage: 122.5 },
    status: 'active',
    evidence: [
      { source: 'concourse_camera', data: { count: 980 }, timestamp: '08:12', confidence: 0.88 },
      { source: 'turnstile_counter', data: { totalThroughput: 1250 }, timestamp: '08:12', confidence: 0.92 },
    ],
  },
  {
    id: 'anom_003',
    type: 'escalator_stop',
    severity: 'medium',
    location: '10号线扶梯2号',
    zoneId: 'escalator_group_b',
    startTime: '07:55',
    peakData: { affectedPassengers: 120 },
    status: 'acknowledged',
    evidence: [
      { source: 'escalator_controller', data: { status: 'stopped' }, timestamp: '07:55', confidence: 1.0 },
      { source: 'maintenance_system', data: { hasRecord: false }, timestamp: '07:55', confidence: 0.9 },
    ],
  },
  {
    id: 'anom_004',
    type: 'capacity_warning',
    severity: 'medium',
    location: '1号线站台',
    zoneId: 'platform_line1',
    startTime: '08:10',
    peakData: { count: 460, capacity: 500, percentage: 92 },
    status: 'active',
    evidence: [
      { source: 'platform_sensor', data: { count: 460 }, timestamp: '08:15', confidence: 0.85 },
    ],
  },
  {
    id: 'anom_005',
    type: 'reflow',
    severity: 'high',
    location: '主通道',
    zoneId: 'corridor_main',
    startTime: '08:20',
    peakData: { reflowPercentage: 35 },
    status: 'active',
    evidence: [
      { source: 'corridor_sensor_a', data: { flowIn: 180, flowOut: 280 }, timestamp: '08:22', confidence: 0.9 },
      { source: 'corridor_sensor_b', data: { flowIn: 200, flowOut: 260 }, timestamp: '08:22', confidence: 0.88 },
    ],
  },
];

export const mockConflictLogs: ConflictLog[] = [
  {
    id: 'conf_001',
    timestamp: '2026-05-30 08:05:00',
    conflictType: 'passenger_count_mismatch',
    sources: {
      concourse: { count: 980, source: 'camera_ai' },
      turnstile: { totalThroughput: 890, source: 'hardware_counter' },
      escalator: { transferCount: 420, source: 'infrared_sensor' },
    },
    confidenceScores: {
      concourse: 0.88,
      turnstile: 0.92,
      escalator: 0.78,
    },
    resolution: 'auto_resolved',
    resolvedAt: '2026-05-30 08:05:15',
    notes: '采用闸机数据（置信度最高），已标注站厅摄像头可能存在重复计数',
  },
  {
    id: 'conf_002',
    timestamp: '2026-05-30 08:12:00',
    conflictType: 'direction_conflict',
    sources: {
      escalator: { direction: 'down', deviceId: 'esc_1_3' },
      concourse: { expectedFlow: 'up', reason: 'morning_peak' },
    },
    confidenceScores: {
      concourse: 1.0,
      turnstile: 0.0,
      escalator: 0.95,
    },
    resolution: 'manual_resolved',
    resolvedBy: '站务-张工',
    resolvedAt: '2026-05-30 08:15:00',
    notes: '确认为方向设置错误，已远程调整为上行。怀疑是夜间测试后未恢复',
    linkedAnomalyId: 'anom_001',
  },
  {
    id: 'conf_003',
    timestamp: '2026-05-30 08:18:00',
    conflictType: 'capacity_data_conflict',
    sources: {
      concourse: { count: 920, density: 3.1 },
      turnstile: { entryRate: 45, exitRate: 38 },
      escalator: { transferRate: 32 },
    },
    confidenceScores: {
      concourse: 0.85,
      turnstile: 0.9,
      escalator: 0.8,
    },
    resolution: 'pending',
    notes: '数据偏差超过15%，需要人工复核',
  },
];

export const mockHistoricalRecords = [
  {
    id: 'record_20260529',
    date: '2026-05-29',
    startTime: '07:00',
    endTime: '09:30',
    anomalyCount: 4,
    conflictCount: 2,
    peakPassengers: 920,
    operator: '站务-李工',
    notes: '早高峰整体平稳，8:15主站厅短时超限，已启动限流',
  },
  {
    id: 'record_20260528',
    date: '2026-05-28',
    startTime: '07:00',
    endTime: '09:30',
    anomalyCount: 3,
    conflictCount: 1,
    peakPassengers: 850,
    operator: '站务-王工',
    notes: '10号线扶梯故障停运20分钟，已安排人工引导',
  },
];
