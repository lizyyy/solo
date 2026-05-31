import type {
  Material,
  Batch,
  ShiftRecord,
  WorkLog,
  WorkLogVersion,
  MaintenanceOrder,
  ChangeNotification,
} from '@/types';
import { generateId } from './helpers';
import { parseWorkLogContent } from './changeDetection';

const now = Date.now();

export const mockMaterials: Material[] = [
  {
    id: 'mat-001',
    name: 'X70管线钢',
    spec: 'Φ1016×17.5mm',
    batchNo: 'GX-2024-001',
    productionDate: now - 7 * 24 * 60 * 60 * 1000,
    supplier: '武汉钢铁集团',
    heatNumber: 'H20240115-01',
  },
  {
    id: 'mat-002',
    name: 'X80管线钢',
    spec: 'Φ1219×22.0mm',
    batchNo: 'GX-2024-002',
    productionDate: now - 3 * 24 * 60 * 60 * 1000,
    supplier: '宝山钢铁股份',
    heatNumber: 'H20240115-02',
  },
  {
    id: 'mat-003',
    name: 'L360管线钢',
    spec: 'Φ610×12.7mm',
    batchNo: 'GX-2024-003',
    productionDate: now - 1 * 24 * 60 * 60 * 1000,
    supplier: '鞍山钢铁集团',
    heatNumber: 'H20240115-03',
  },
];

export const mockBatches: Batch[] = [
  {
    id: 'batch-001',
    materialId: 'mat-001',
    material: mockMaterials[0],
    status: 'active',
    startTime: now - 5 * 24 * 60 * 60 * 1000,
    endTime: null,
    lineNumber: 'L3-01',
  },
  {
    id: 'batch-002',
    materialId: 'mat-002',
    material: mockMaterials[1],
    status: 'completed',
    startTime: now - 10 * 24 * 60 * 60 * 1000,
    endTime: now - 6 * 24 * 60 * 60 * 1000,
    lineNumber: 'L3-02',
  },
  {
    id: 'batch-003',
    materialId: 'mat-003',
    material: mockMaterials[2],
    status: 'active',
    startTime: now - 12 * 60 * 60 * 1000,
    endTime: null,
    lineNumber: 'L3-03',
  },
];

export const mockShiftRecords: ShiftRecord[] = [
  {
    id: 'shift-001',
    batchId: 'batch-001',
    operator: '张工',
    shift: 'day',
    recordTime: now - 4 * 24 * 60 * 60 * 1000,
    content: '白班正常生产，压力稳定在6.5MPa左右。10:30检查3#泵，运行正常。\n14:00进行例行巡检，所有仪表读数正常。',
    hasAbnormal: false,
    pressureReadings: [
      { timestamp: now - 4 * 24 * 60 * 60 * 1000, pressure: 6.2 },
      { timestamp: now - 4 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000, pressure: 6.5 },
      { timestamp: now - 4 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000, pressure: 6.8 },
    ],
  },
  {
    id: 'shift-002',
    batchId: 'batch-001',
    operator: '李工',
    shift: 'night',
    recordTime: now - 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000,
    content: '夜班生产正常。凌晨2:00发现压力略有波动，最高达到9.2MPa。已通知中控室监控。',
    hasAbnormal: true,
    abnormalDescription: '压力波动，峰值9.2MPa',
    pressureReadings: [
      { timestamp: now - 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000, pressure: 7.2 },
      { timestamp: now - 4 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000, pressure: 8.5 },
      { timestamp: now - 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000, pressure: 9.2 },
    ],
  },
  {
    id: 'shift-003',
    batchId: 'batch-001',
    operator: '王工',
    shift: 'day',
    recordTime: now - 3 * 24 * 60 * 60 * 1000,
    content: '今日生产压力较高，多次超过警戒值。11:15压力达到10.8MPa，紧急泄压处理。已联系维修人员检查。',
    hasAbnormal: true,
    abnormalDescription: '压力多次超警戒，最高10.8MPa',
    pressureReadings: [
      { timestamp: now - 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000, pressure: 8.2 },
      { timestamp: now - 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000, pressure: 9.5 },
      { timestamp: now - 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000 + 15 * 60 * 1000, pressure: 10.8 },
      { timestamp: now - 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000, pressure: 7.5 },
    ],
  },
  {
    id: 'shift-004',
    batchId: 'batch-001',
    operator: '赵工',
    shift: 'night',
    recordTime: now - 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000,
    content: '夜班继续监控压力，整体平稳。维修人员检查2#阀，发现密封件磨损，已报备更换。',
    hasAbnormal: true,
    abnormalDescription: '2#阀密封件磨损',
    pressureReadings: [
      { timestamp: now - 3 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000, pressure: 6.8 },
      { timestamp: now - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000, pressure: 7.0 },
    ],
  },
  {
    id: 'shift-005',
    batchId: 'batch-001',
    operator: '张工',
    shift: 'day',
    recordTime: now - 2 * 24 * 60 * 60 * 1000,
    content: '更换2#阀密封件后运行正常。压力稳定在6.0-7.0MPa区间。生产进度正常。',
    hasAbnormal: false,
    pressureReadings: [
      { timestamp: now - 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000, pressure: 6.2 },
      { timestamp: now - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000, pressure: 6.8 },
      { timestamp: now - 2 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000, pressure: 6.5 },
    ],
  },
  {
    id: 'shift-006',
    batchId: 'batch-002',
    operator: '刘工',
    shift: 'day',
    recordTime: now - 8 * 24 * 60 * 60 * 1000,
    content: 'X80钢批次开始生产，设备调试完成。压力设定8.5MPa，运行稳定。',
    hasAbnormal: false,
    pressureReadings: [
      { timestamp: now - 8 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000, pressure: 8.2 },
      { timestamp: now - 8 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000, pressure: 8.5 },
    ],
  },
];

export const mockWorkLogs: WorkLog[] = [
  {
    id: 'log-001',
    equipmentId: 'EQ-PUMP-003',
    batchId: 'batch-001',
    operator: '系统自动',
    currentVersion: 2,
    startTime: now - 5 * 24 * 60 * 60 * 1000,
    endTime: now - 1 * 24 * 60 * 60 * 1000,
    description: '3#主泵运行工况日志',
    hasDataChange: true,
    content: `TIME,EVENT,PRESSURE_MPA
2024-01-11 08:00:00,设备启动,5.2
2024-01-11 09:30:00,压力检测,6.5
2024-01-11 11:00:00,压力波动,8.2
2024-01-11 12:30:00,压力恢复,6.8
2024-01-12 02:00:00,异常报警,9.2
2024-01-12 02:15:00,紧急处理,8.3
2024-01-12 11:15:00,危险警报,10.8
2024-01-12 11:30:00,泄压操作,7.5
2024-01-13 08:00:00,正常运行,6.2
2024-01-13 12:00:00,压力检测,6.8`,
  },
  {
    id: 'log-002',
    equipmentId: 'EQ-VALVE-002',
    batchId: 'batch-001',
    operator: '系统自动',
    currentVersion: 1,
    startTime: now - 5 * 24 * 60 * 60 * 1000,
    endTime: now - 1 * 24 * 60 * 60 * 1000,
    description: '2#调节阀运行日志',
    hasDataChange: false,
    content: `TIME,EVENT,PRESSURE_MPA
2024-01-11 08:00:00,阀门开启,5.0
2024-01-11 10:00:00,开度调整,6.0
2024-01-12 03:00:00,开度调整,8.0
2024-01-12 11:20:00,紧急关闭,0.0
2024-01-12 11:45:00,重新开启,5.0
2024-01-13 08:00:00,正常运行,6.0`,
  },
  {
    id: 'log-003',
    equipmentId: 'EQ-PUMP-001',
    batchId: 'batch-002',
    operator: '系统自动',
    currentVersion: 1,
    startTime: now - 10 * 24 * 60 * 60 * 1000,
    endTime: now - 6 * 24 * 60 * 60 * 1000,
    description: '1#主泵运行工况日志',
    hasDataChange: false,
    content: `TIME,EVENT,PRESSURE_MPA
2024-01-06 08:00:00,设备启动,7.5
2024-01-06 12:00:00,压力检测,8.2
2024-01-06 16:00:00,压力检测,8.5
2024-01-07 08:00:00,压力检测,8.3
2024-01-07 12:00:00,压力检测,8.7
2024-01-08 08:00:00,压力检测,8.0`,
  },
];

const contentV1 = `TIME,EVENT,PRESSURE_MPA
2024-01-11 08:00:00,设备启动,5.2
2024-01-11 09:30:00,压力检测,6.5
2024-01-11 11:00:00,压力波动,7.5
2024-01-11 12:30:00,压力恢复,6.8
2024-01-12 02:00:00,异常报警,8.5
2024-01-12 02:15:00,紧急处理,8.3
2024-01-12 11:15:00,危险警报,9.5
2024-01-12 11:30:00,泄压操作,7.5
2024-01-13 08:00:00,正常运行,6.2
2024-01-13 12:00:00,压力检测,6.8`;

const contentV2 = `TIME,EVENT,PRESSURE_MPA
2024-01-11 08:00:00,设备启动,5.2
2024-01-11 09:30:00,压力检测,6.5
2024-01-11 11:00:00,压力波动,8.2
2024-01-11 12:30:00,压力恢复,6.8
2024-01-12 02:00:00,异常报警,9.2
2024-01-12 02:15:00,紧急处理,8.3
2024-01-12 11:15:00,危险警报,10.8
2024-01-12 11:30:00,泄压操作,7.5
2024-01-13 08:00:00,正常运行,6.2
2024-01-13 12:00:00,压力检测,6.8`;

const contentV3 = `TIME,EVENT,PRESSURE_MPA
2024-01-11 08:00:00,阀门开启,5.0
2024-01-11 10:00:00,开度调整,6.0
2024-01-12 03:00:00,开度调整,8.0
2024-01-12 11:20:00,紧急关闭,0.0
2024-01-12 11:45:00,重新开启,5.0
2024-01-13 08:00:00,正常运行,6.0`;

const contentV4 = `TIME,EVENT,PRESSURE_MPA
2024-01-06 08:00:00,设备启动,7.5
2024-01-06 12:00:00,压力检测,8.2
2024-01-06 16:00:00,压力检测,8.5
2024-01-07 08:00:00,压力检测,8.3
2024-01-07 12:00:00,压力检测,8.7
2024-01-08 08:00:00,压力检测,8.0`;

export const mockWorkLogVersions: WorkLogVersion[] = [
  {
    id: 'logv-001',
    workLogId: 'log-001',
    version: 1,
    operator: '系统自动',
    timestamp: now - 5 * 24 * 60 * 60 * 1000,
    content: contentV1,
    parsedData: parseWorkLogContent(contentV1),
    changeDescription: '初始版本',
  },
  {
    id: 'logv-002',
    workLogId: 'log-001',
    version: 2,
    operator: '张工',
    timestamp: now - 2 * 24 * 60 * 60 * 1000,
    content: contentV2,
    parsedData: parseWorkLogContent(contentV2),
    changeDescription: '补传校准后的数据，修正了3处压力读数',
  },
  {
    id: 'logv-003',
    workLogId: 'log-002',
    version: 1,
    operator: '系统自动',
    timestamp: now - 5 * 24 * 60 * 60 * 1000,
    content: contentV3,
    parsedData: parseWorkLogContent(contentV3),
    changeDescription: '初始版本',
  },
  {
    id: 'logv-004',
    workLogId: 'log-003',
    version: 1,
    operator: '系统自动',
    timestamp: now - 10 * 24 * 60 * 60 * 1000,
    content: contentV4,
    parsedData: parseWorkLogContent(contentV4),
    changeDescription: '初始版本',
  },
];

export const mockMaintenanceOrders: MaintenanceOrder[] = [
  {
    id: 'maint-001',
    orderNo: 'MO-2024-001',
    equipment: '3#主泵',
    batchId: 'batch-001',
    technician: '陈师傅',
    faultDescription: '压力异常波动，超过警戒值\n连续3天出现压力突增现象，最高达到10.8MPa',
    maintenanceContent: '1. 检查泵体密封\n2. 更换2#调节阀密封件\n3. 校准压力传感器\n4. 重新测试压力稳定性',
    partsReplaced: '2#调节阀密封件 × 1\n压力传感器密封圈 × 2',
    status: 'completed',
    priority: 'high',
    startTime: now - 3 * 24 * 60 * 60 * 1000,
    endTime: now - 2 * 24 * 60 * 60 * 1000,
    relatedPressureValues: [9.2, 10.8, 8.5],
  },
  {
    id: 'maint-002',
    orderNo: 'MO-2024-002',
    equipment: '1#输送管道',
    batchId: 'batch-001',
    technician: '周师傅',
    faultDescription: '例行维护检查\n根据设备维护计划，进行季度检查',
    maintenanceContent: '1. 管道壁厚检测\n2. 法兰螺栓紧固\n3. 防腐层检查\n4. 泄漏测试',
    partsReplaced: null,
    status: 'in-progress',
    priority: 'normal',
    startTime: now - 1 * 24 * 60 * 60 * 1000,
    endTime: null,
    relatedPressureValues: [6.5, 7.2],
  },
  {
    id: 'maint-003',
    orderNo: 'MO-2024-003',
    equipment: '2#换热器',
    batchId: 'batch-002',
    technician: '吴师傅',
    faultDescription: '换热效率下降\n出入口温差减少5℃，怀疑结垢',
    maintenanceContent: '1. 化学清洗\n2. 更换密封垫片\n3. 压力测试\n4. 效能验证',
    partsReplaced: '密封垫片 × 8',
    status: 'pending',
    priority: 'normal',
    startTime: now + 24 * 60 * 60 * 1000,
    endTime: null,
    relatedPressureValues: [8.2, 8.5],
  },
];

export const mockNotifications: ChangeNotification[] = [
  {
    id: 'notif-001',
    workLogId: 'log-001',
    workLogVersion: 2,
    timestamp: now - 2 * 24 * 60 * 60 * 1000,
    operator: '张工',
    reviewed: false,
    reviewedBy: null,
    reviewedAt: null,
    affectedConclusionIds: ['conc-001', 'conc-002'],
    diffSummary: '3处压力读数被修正，其中2处升级到更高阈值等级',
  },
];
