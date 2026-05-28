import type { DataSourceStatus, DataQualityIssue } from '../types';

const NOW = Date.now();

const qualityIssues: DataQualityIssue[] = [
  {
    id: 'issue-001',
    type: 'trajectory_break',
    severity: 'warning',
    entityType: 'trajectory',
    entityId: 'traj-00046',
    description: '轨迹断点：robot-006 在该点前后时间差45秒，超过30秒阈值',
    canFix: true,
  },
  {
    id: 'issue-002',
    type: 'trajectory_break',
    severity: 'warning',
    entityType: 'trajectory',
    entityId: 'traj-00121',
    description: '轨迹断点：robot-001 在该点前后时间差45秒，超过30秒阈值',
    canFix: true,
  },
  {
    id: 'issue-003',
    type: 'floor_confusion',
    severity: 'error',
    entityType: 'trajectory',
    entityId: 'traj-00081',
    fieldName: 'floor',
    description: '楼层混淆：Z轴坐标偏差1.2米，无法确定归属楼层',
    canFix: true,
  },
  {
    id: 'issue-004',
    type: 'floor_confusion',
    severity: 'error',
    entityType: 'trajectory',
    entityId: 'traj-00201',
    fieldName: 'floor',
    description: '楼层异常：floor=0，Z轴坐标为-1.2米，超出正常范围',
    canFix: true,
  },
  {
    id: 'issue-005',
    type: 'floor_confusion',
    severity: 'error',
    entityType: 'trajectory',
    entityId: 'traj-00311',
    fieldName: 'floor',
    description: '楼层异常：floor=99，Z轴坐标为100米，严重超出范围',
    canFix: false,
  },
  {
    id: 'issue-006',
    type: 'duplicate_queue',
    severity: 'warning',
    entityType: 'charging',
    entityId: 'queue-003',
    fieldName: 'robotId',
    description: '重复排队：robot-005 在 station-000 连续排队3次，已自动去重',
    canFix: false,
  },
  {
    id: 'issue-007',
    type: 'duplicate_queue',
    severity: 'warning',
    entityType: 'charging',
    entityId: 'queue-006',
    fieldName: 'robotId',
    description: '重复排队：robot-003 在 station-004 连续排队3次，已自动去重',
    canFix: false,
  },
  {
    id: 'issue-008',
    type: 'duplicate_queue',
    severity: 'warning',
    entityType: 'charging',
    entityId: 'queue-014',
    fieldName: 'robotId',
    description: '重复排队：robot-002 在 station-005 连续排队2次，已自动去重',
    canFix: false,
  },
  {
    id: 'issue-009',
    type: 'missing_field',
    severity: 'error',
    entityType: 'shelf',
    entityId: 'shelf-016',
    fieldName: 'capacity',
    description: '数据缺失：shelf-016 的容量、库存、SKU列表均为空',
    canFix: true,
  },
  {
    id: 'issue-010',
    type: 'missing_field',
    severity: 'error',
    entityType: 'shelf',
    entityId: 'shelf-043',
    fieldName: 'currentStock',
    description: '数据异常：shelf-043 的当前库存为-5，值为负数',
    canFix: true,
  },
  {
    id: 'issue-011',
    type: 'missing_field',
    severity: 'warning',
    entityType: 'shelf',
    entityId: 'shelf-069',
    fieldName: 'currentStock',
    description: '数据异常：shelf-069 的当前库存150超过容量100',
    canFix: true,
  },
  {
    id: 'issue-012',
    type: 'missing_field',
    severity: 'warning',
    entityType: 'order',
    entityId: 'wave-003',
    fieldName: 'skuList',
    description: '数据不完整：wave-003 的SKU列表仅包含20条，预计58条',
    canFix: true,
  },
  {
    id: 'issue-013',
    type: 'missing_field',
    severity: 'error',
    entityType: 'order',
    entityId: 'wave-004',
    fieldName: 'endTime',
    description: '数据缺失：wave-004 的结束时间为0',
    canFix: true,
  },
  {
    id: 'issue-014',
    type: 'missing_field',
    severity: 'warning',
    entityType: 'order',
    entityId: 'wave-005',
    fieldName: 'skuList',
    description: '数据异常：wave-005 的SKU列表为空',
    canFix: true,
  },
  {
    id: 'issue-015',
    type: 'missing_field',
    severity: 'error',
    entityType: 'congestion',
    entityId: 'congestion-013',
    fieldName: 'endTime',
    description: '数据缺失：congestion-013 的结束时间为0',
    canFix: true,
  },
  {
    id: 'issue-016',
    type: 'missing_field',
    severity: 'error',
    entityType: 'congestion',
    entityId: 'congestion-016',
    fieldName: 'robotCount',
    description: '数据异常：congestion-016 的机器人数量为-3',
    canFix: true,
  },
  {
    id: 'issue-017',
    type: 'missing_field',
    severity: 'warning',
    entityType: 'congestion',
    entityId: 'congestion-019',
    fieldName: 'startTime',
    description: '数据异常：congestion-019 的开始时间晚于结束时间',
    canFix: true,
  },
  {
    id: 'issue-018',
    type: 'missing_field',
    severity: 'warning',
    entityType: 'congestion',
    entityId: 'congestion-006',
    fieldName: 'shelfId',
    description: '关联异常：congestion-006 关联的 shelf-999 不存在',
    canFix: false,
  },
  {
    id: 'issue-019',
    type: 'missing_field',
    severity: 'warning',
    entityType: 'congestion',
    entityId: 'congestion-011',
    fieldName: 'reason',
    description: '数据缺失：congestion-011 的拥堵原因字段为空',
    canFix: true,
  },
  {
    id: 'issue-020',
    type: 'floor_confusion',
    severity: 'warning',
    entityType: 'shelf',
    entityId: 'shelf-089',
    fieldName: 'position.z',
    description: '楼层混淆：shelf-089 的Z轴坐标为6.0米，介于2层和3层之间',
    canFix: true,
  },
  {
    id: 'issue-021',
    type: 'floor_confusion',
    severity: 'warning',
    entityType: 'charging',
    entityId: 'station-003',
    fieldName: 'position.z',
    description: '楼层混淆：station-003 的Z轴坐标为10.0米，不在任何楼层',
    canFix: true,
  },
];

export const dataSourceStatuses: DataSourceStatus[] = [
  {
    type: 'warehouse',
    name: '仓库模型数据',
    isConnected: true,
    lastSyncTime: NOW - 300000,
    recordCount: 1,
    qualityScore: 98,
    issues: qualityIssues.filter(i => i.entityType === 'warehouse'),
  },
  {
    type: 'trajectory',
    name: '机器人轨迹数据',
    isConnected: true,
    lastSyncTime: NOW - 15000,
    recordCount: 500,
    qualityScore: 82,
    issues: qualityIssues.filter(i => i.entityType === 'trajectory'),
  },
  {
    type: 'shelf',
    name: '货架信息数据',
    isConnected: true,
    lastSyncTime: NOW - 60000,
    recordCount: 100,
    qualityScore: 88,
    issues: qualityIssues.filter(i => i.entityType === 'shelf'),
  },
  {
    type: 'order',
    name: '订单波次数据',
    isConnected: true,
    lastSyncTime: NOW - 120000,
    recordCount: 5,
    qualityScore: 75,
    issues: qualityIssues.filter(i => i.entityType === 'order'),
  },
  {
    type: 'charging',
    name: '充电区数据',
    isConnected: true,
    lastSyncTime: NOW - 30000,
    recordCount: 10,
    qualityScore: 85,
    issues: qualityIssues.filter(i => i.entityType === 'charging'),
  },
  {
    type: 'congestion',
    name: '拥堵报告数据',
    isConnected: true,
    lastSyncTime: NOW - 45000,
    recordCount: 20,
    qualityScore: 78,
    issues: qualityIssues.filter(i => i.entityType === 'congestion'),
  },
];

export const allQualityIssues: DataQualityIssue[] = qualityIssues;

export const getIssuesBySeverity = (severity: DataQualityIssue['severity']): DataQualityIssue[] => {
  return qualityIssues.filter(i => i.severity === severity);
};

export const getIssuesByType = (type: DataQualityIssue['type']): DataQualityIssue[] => {
  return qualityIssues.filter(i => i.type === type);
};

export const getFixableIssues = (): DataQualityIssue[] => {
  return qualityIssues.filter(i => i.canFix);
};

export const getOverallQualityScore = (): number => {
  const total = dataSourceStatuses.reduce((sum, ds) => sum + ds.qualityScore, 0);
  return Math.round(total / dataSourceStatuses.length);
};

export const getDisconnectedSources = (): DataSourceStatus[] => {
  return dataSourceStatuses.filter(ds => !ds.isConnected);
};

export default dataSourceStatuses;
