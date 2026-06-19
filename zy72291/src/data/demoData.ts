import type { PointCloudLog, SafetyRadius, OperationLog, SafetyReport } from '../../shared/types';

export const demoLogs: PointCloudLog[] = [
  {
    id: 'LOG-001',
    timestamp: '2024-06-15T08:30:00',
    batchNo: 'PC-2024-0615-A',
    pointCount: 1250000,
    thinningRate: 0.85,
    status: 'success',
    source: '机载LiDAR',
    hasScreenshotOcclusion: false,
    rerunCount: 0,
    windDirection: 180,
    windSpeed: 4.5,
    measuredDistance: 185,
    occlusionArea: 0,
    operator: '许工',
    notes: '机载LiDAR扫描，数据质量良好，无遮挡',
    alerts: [
      {
        id: 'A-001',
        type: 'distance',
        level: 'info',
        message: '北侧障碍物距离正常，实测185米，要求150米',
        isOccluded: false,
        position: { x: 120, y: 80, z: 45 }
      }
    ]
  },
  {
    id: 'LOG-002',
    timestamp: '2024-06-15T14:20:00',
    batchNo: 'PC-2024-0615-B',
    pointCount: 980000,
    thinningRate: 0.82,
    status: 'pending_review',
    source: '移动端巡检',
    hasScreenshotOcclusion: true,
    screenshotNote: '告警标签区域被移动端截图水印遮挡约40%，东北方向距离读数存疑，需施工经理复核原始数据',
    rerunCount: 0,
    windDirection: 270,
    windSpeed: 6.2,
    measuredDistance: 88,
    occlusionArea: 40,
    operator: '许工',
    notes: '移动端巡检，告警标签被截图遮挡约40%，待施工经理复核',
    alerts: [
      {
        id: 'A-002',
        type: 'distance',
        level: 'danger',
        message: '东北方向安全距离不足，实测88米，要求200米',
        isOccluded: true,
        position: { x: 95, y: -110, z: 38 }
      },
      {
        id: 'A-003',
        type: 'obstacle',
        level: 'warning',
        message: '高压塔位置标记存疑，坐标偏差约12米',
        isOccluded: false,
        position: { x: 80, y: -90, z: 52 }
      }
    ]
  },
  {
    id: 'LOG-003',
    timestamp: '2024-06-14T16:45:00',
    batchNo: 'PC-2024-0614-A',
    pointCount: 1120000,
    thinningRate: 0.88,
    status: 'legacy',
    source: '历史数据补录',
    hasScreenshotOcclusion: false,
    rerunCount: 1,
    windDirection: 90,
    windSpeed: 3.8,
    measuredDistance: 195,
    occlusionArea: 0,
    operator: '许工',
    notes: '2023年历史数据，已从旧口径安全半径表补录，含1次人工修正和1次重跑',
    manualCorrections: [
      {
        id: 'CORR-001',
        logId: 'LOG-003',
        field: 'windDirection',
        oldValue: 85,
        newValue: 90,
        operator: '许工',
        timestamp: '2024-06-15T14:35:00',
        reason: '现场风向记录与历史数据存在5度偏差，经核实修正为90度'
      }
    ],
    alerts: [
      {
        id: 'A-004',
        type: 'height',
        level: 'warning',
        message: '相对高度按2023旧口径计算，安全裕度降低20%',
        isOccluded: false,
        position: { x: -60, y: 130, z: 41 }
      }
    ]
  }
];

export const demoRadius: SafetyRadius[] = [
  { id: 'R-001', windDirection: 0, windSpeed: 'low', radius: 150, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-002', windDirection: 0, windSpeed: 'low', radius: 120, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-003', windDirection: 45, windSpeed: 'medium', radius: 200, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-004', windDirection: 45, windSpeed: 'medium', radius: 160, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-005', windDirection: 90, windSpeed: 'high', radius: 280, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-006', windDirection: 90, windSpeed: 'high', radius: 220, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-007', windDirection: 135, windSpeed: 'medium', radius: 220, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-008', windDirection: 135, windSpeed: 'medium', radius: 180, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-009', windDirection: 180, windSpeed: 'low', radius: 180, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-010', windDirection: 180, windSpeed: 'low', radius: 140, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-011', windDirection: 225, windSpeed: 'medium', radius: 240, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-012', windDirection: 225, windSpeed: 'medium', radius: 200, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-013', windDirection: 270, windSpeed: 'high', radius: 300, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-014', windDirection: 270, windSpeed: 'high', radius: 240, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-015', windDirection: 315, windSpeed: 'medium', radius: 210, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-016', windDirection: 315, windSpeed: 'medium', radius: 170, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
];

export const demoOperations: OperationLog[] = [
  {
    id: 'OP-001',
    operator: 'engineer',
    operatorName: '许工',
    action: '导入点云抽稀日志',
    timestamp: '2024-06-15T08:35:00',
    detail: '导入批次 PC-2024-0615-A，点数125万，抽稀率85%',
    targetId: 'LOG-001'
  },
  {
    id: 'OP-002',
    operator: 'engineer',
    operatorName: '许工',
    action: '导入点云抽稀日志',
    timestamp: '2024-06-15T14:25:00',
    detail: '导入批次 PC-2024-0615-B，检测到移动端截图遮挡告警标签',
    targetId: 'LOG-002'
  },
  {
    id: 'OP-003',
    operator: 'engineer',
    operatorName: '许工',
    action: '标记截图遮挡',
    timestamp: '2024-06-15T14:28:00',
    detail: '标记 LOG-002 存在截图遮挡，状态变更为待施工经理复核',
    targetId: 'LOG-002'
  },
  {
    id: 'OP-004',
    operator: 'engineer',
    operatorName: '许工',
    action: '补录安全半径表',
    timestamp: '2024-06-15T14:45:00',
    detail: '从2023版规范补录旧口径数据6条，用于LOG-003历史记录',
    targetId: 'LOG-003'
  },
  {
    id: 'OP-005',
    operator: 'engineer',
    operatorName: '许工',
    action: '人工修正',
    timestamp: '2024-06-15T14:50:00',
    detail: '修正LOG-003高度计算口径，标注使用2023旧标准',
    targetId: 'LOG-003'
  },
  {
    id: 'OP-006',
    operator: 'engineer',
    operatorName: '许工',
    action: '重跑分析',
    timestamp: '2024-06-15T14:55:00',
    detail: 'LOG-003 第一次重跑完成，使用混合口径生成报告',
    targetId: 'LOG-003'
  },
  {
    id: 'OP-007',
    operator: 'engineer',
    operatorName: '许工',
    action: '生成安全距离报告',
    timestamp: '2024-06-15T15:00:00',
    detail: '生成包含3条记录的安全距离报告，其中1条待复核',
  },
];

export const generateDemoReport = (): SafetyReport => {
  return {
    id: 'RPT-001',
    generatedAt: new Date().toISOString(),
    logIds: ['LOG-001', 'LOG-002', 'LOG-003'],
    radiusVersion: 'mixed',
    status: 'pending_review',
    notes: '报告包含三种处理结果对比，LOG-002需施工经理复核后才能最终确认',
    results: [
      {
        id: 'RES-001',
        recordId: 'LOG-001',
        recordType: 'success',
        safetyDistance: 185,
        requiredDistance: 150,
        compliance: true,
        note: '顺利记录，机载LiDAR数据完整，东北方向障碍物距离185米符合要求',
        windDirection: 0,
        windSpeed: 'low'
      },
      {
        id: 'RES-002',
        recordId: 'LOG-002',
        recordType: 'blocked',
        safetyDistance: 88,
        requiredDistance: 200,
        compliance: false,
        note: '截图遮挡记录，移动端巡检数据告警标签被水印遮挡约40%，东北方向距离读数存疑，建议复核原始热成像数据',
        windDirection: 45,
        windSpeed: 'medium'
      },
      {
        id: 'RES-003',
        recordId: 'LOG-003',
        safetyDistance: 195,
        requiredDistance: 220,
        recordType: 'legacy',
        compliance: false,
        note: '旧口径补录记录，2023版标准要求200米，2024版要求220米。按旧口径达标，按新口径不达标，已标注差异',
        windDirection: 90,
        windSpeed: 'high'
      }
    ],
    items: [
      {
        logId: 'LOG-001',
        batchNo: 'PC-2024-0615-A',
        status: 'success',
        windDirection: 0,
        windSpeed: 1,
        measuredDistance: 185,
        requiredDistance: 150,
        diff: 35,
        compliance: 'compliant',
        hasScreenshotOcclusion: false,
        occlusionArea: 0,
        version: 'new',
        notes: '机载LiDAR数据完整，北侧障碍物距离正常'
      },
      {
        logId: 'LOG-002',
        batchNo: 'PC-2024-0615-B',
        status: 'blocked',
        windDirection: 45,
        windSpeed: 2,
        measuredDistance: 88,
        requiredDistance: 200,
        diff: -112,
        compliance: 'pending',
        hasScreenshotOcclusion: true,
        occlusionArea: 40,
        version: 'new',
        notes: '移动端巡检数据告警标签被水印遮挡约40%，需复核原始热成像数据'
      },
      {
        logId: 'LOG-003',
        batchNo: 'PC-2024-0614-A',
        status: 'legacy',
        windDirection: 90,
        windSpeed: 3,
        measuredDistance: 195,
        requiredDistance: 220,
        diff: -25,
        compliance: 'non_compliant',
        hasScreenshotOcclusion: false,
        occlusionArea: 0,
        version: 'legacy',
        notes: '从2023版安全半径表补录旧口径数据，原记录缺失风速>12m/s工况参数'
      }
    ],
    stats: {
      total: 3,
      compliant: 1,
      warning: 0,
      nonCompliant: 1,
      pendingReview: 1
    },
    summary: '本报告包含3条点云抽稀日志评估记录，覆盖3种工况场景。LOG-001采用2024新口径评估合规，LOG-002因截图遮挡需施工经理复核原始数据，LOG-003采用2023旧口径补录数据，按新口径评估不合规。安全半径表采用新旧混合口径，共16条记录覆盖8个主要风向。',
    generatedBy: '许工（设备工程师）'
  };
};
