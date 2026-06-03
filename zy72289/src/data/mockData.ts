import type { PointCloudLog, SafetyRadiusEntry, DetectedObstacle } from '@/types';

const baseTime = new Date('2026-06-03T09:00:00');

const formatTime = (offsetMinutes: number) => {
  const t = new Date(baseTime.getTime() + offsetMinutes * 60000);
  return t.toISOString();
};

export const normalObstacles: DetectedObstacle[] = [
  {
    id: 'obs-001',
    name: '#1主变压器',
    position: { x: 0, y: 1.5, z: 0 },
    detectedRadius: 3.0,
    status: 'normal',
    deviceId: 'DEV-001',
    voltageLevel: '220kV',
  },
  {
    id: 'obs-002',
    name: '220kV出线构架',
    position: { x: 5, y: 2, z: 3 },
    detectedRadius: 2.5,
    status: 'normal',
    deviceId: 'DEV-002',
    voltageLevel: '220kV',
  },
];

export const duplicateNameObstacles: DetectedObstacle[] = [
  {
    id: 'obs-003',
    name: '母线架构A',
    alias: '构架支架B',
    position: { x: -3, y: 2.5, z: 2 },
    detectedRadius: 2.0,
    status: 'pending_review',
    conflictNote: '同一障碍物被标注为两个名称："母线架构A" 和 "构架支架B"，请学员复核确认',
    deviceId: 'DEV-003',
    voltageLevel: '35kV',
  },
  {
    id: 'obs-004',
    name: '构架支架B',
    alias: '母线架构A',
    position: { x: -3, y: 2.5, z: 2 },
    detectedRadius: 2.0,
    status: 'pending_review',
    conflictNote: '与"母线架构A"为同一物体，位置坐标完全一致',
    deviceId: 'DEV-003',
    voltageLevel: '35kV',
  },
];

export const oldCaliberObstacles: DetectedObstacle[] = [
  {
    id: 'obs-005',
    name: '10kV开关柜#3',
    position: { x: 3, y: 1, z: -2 },
    detectedRadius: 1.5,
    status: 'conflict',
    conflictNote: '日志使用旧口径1.5米，安全半径表已更新为2.0米',
    correctedRadius: 2.0,
    deviceId: 'DEV-005',
    voltageLevel: '10kV',
  },
];

export const allObstacles: DetectedObstacle[] = [
  ...normalObstacles,
  ...duplicateNameObstacles,
  ...oldCaliberObstacles,
];

export const initialPointCloudLogs: PointCloudLog[] = [];

export const normalLog: PointCloudLog = {
  id: 'log-001',
  deviceId: 'DEV-001',
  deviceName: '#1主变压器区域',
  thinningParams: {
    voxelSize: 0.05,
    maxPoints: 50000,
    quality: 'high',
  },
  detectedObstacles: normalObstacles,
  importTime: formatTime(0),
  operator: '园区运维小陶',
  status: 'imported',
  scenarioType: 'normal',
};

export const duplicateNameLog: PointCloudLog = {
  id: 'log-002',
  deviceId: 'DEV-003',
  deviceName: '35kV母线区域',
  thinningParams: {
    voxelSize: 0.05,
    maxPoints: 45000,
    quality: 'high',
  },
  detectedObstacles: duplicateNameObstacles,
  importTime: formatTime(10),
  operator: '园区运维小陶',
  status: 'imported',
  scenarioType: 'duplicate_name',
};

export const oldCaliberLog: PointCloudLog = {
  id: 'log-003',
  deviceId: 'DEV-005',
  deviceName: '10kV开关柜区域',
  thinningParams: {
    voxelSize: 0.05,
    maxPoints: 30000,
    quality: 'medium',
  },
  detectedObstacles: oldCaliberObstacles,
  importTime: formatTime(20),
  operator: '园区运维小陶',
  status: 'imported',
  scenarioType: 'old_caliber',
};

export const safetyRadiusTable: SafetyRadiusEntry[] = [
  {
    id: 'radius-001',
    deviceId: 'DEV-001',
    deviceName: '#1主变压器',
    voltageLevel: '220kV',
    oldRadius: 3.0,
    newRadius: 3.0,
    version: 'v2.1',
    effectiveDate: '2026-01-01',
    isCurrent: true,
  },
  {
    id: 'radius-002',
    deviceId: 'DEV-002',
    deviceName: '220kV出线构架',
    voltageLevel: '220kV',
    oldRadius: 2.5,
    newRadius: 2.5,
    version: 'v2.1',
    effectiveDate: '2026-01-01',
    isCurrent: true,
  },
  {
    id: 'radius-003',
    deviceId: 'DEV-003',
    deviceName: '35kV母线架构',
    voltageLevel: '35kV',
    oldRadius: 2.0,
    newRadius: 2.0,
    version: 'v2.0',
    effectiveDate: '2025-06-01',
    isCurrent: true,
  },
  {
    id: 'radius-005',
    deviceId: 'DEV-005',
    deviceName: '10kV开关柜',
    voltageLevel: '10kV',
    oldRadius: 1.5,
    newRadius: 2.0,
    version: 'v2.1',
    effectiveDate: '2026-03-15',
    isCurrent: true,
    hasConflict: true,
  },
];

export const scenarioDescriptions: Record<string, { title: string; description: string; icon: string }> = {
  normal: {
    title: '顺利记录',
    description: '点云抽稀日志数据与安全半径表完全一致，标注正常。这是最理想的情况，所有参数匹配，无需额外处理。',
    icon: '✅',
  },
  duplicate_name: {
    title: '同物异名',
    description: '35kV母线架构在日志中被标注为"母线架构A"和"构架支架B"两个名字，实际是同一个物体。需要培训学员发现并复核。',
    icon: '⚠️',
  },
  old_caliber: {
    title: '旧口径',
    description: '10kV开关柜日志使用旧口径安全半径1.5米，但安全半径表已于2026年3月15日更新为2.0米。需要人工修正后重跑。',
    icon: '🔄',
  },
};
