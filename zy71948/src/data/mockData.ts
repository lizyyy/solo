import { PayloadPlan, FaultRecord, OrbitElement, Anomaly, StateSnapshot, AuditLog, TimeSystem } from '../types';

const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const yesterday = new Date(today);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];
const dayBefore = new Date(today);
dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);
const dayBeforeStr = dayBefore.toISOString().split('T')[0];

export const mockPayloadPlans: PayloadPlan[] = [
  {
    id: 'payload-1',
    name: '高分辨率相机成像',
    timeSystem: 'UTC',
    startTime: `${dateStr}T02:00:00`,
    endTime: `${dateStr}T04:30:00`,
    powerConsumption: 120,
    planType: 'NORMAL',
    recordType: 'REAL_CHANGE',
    operator: '张工',
    createdAt: new Date().toISOString(),
    remark: '常规成像任务'
  },
  {
    id: 'payload-2',
    name: '数据中继传输',
    timeSystem: 'BEIJING',
    startTime: `${dateStr}T10:00:00`,
    endTime: `${dateStr}T11:30:00`,
    powerConsumption: 85,
    planType: 'ADVANCED',
    recordType: 'REAL_CHANGE',
    operator: '李工',
    createdAt: new Date().toISOString(),
    remark: '计划提前，原计划12:00开始'
  },
  {
    id: 'payload-3',
    name: '姿态控制校准',
    timeSystem: 'TAI',
    startTime: `${dateStr}T06:15:00`,
    endTime: `${dateStr}T07:00:00`,
    powerConsumption: 95,
    planType: 'NORMAL',
    recordType: 'SUPPLEMENT',
    operator: '王工',
    createdAt: new Date().toISOString(),
    remark: '补材料：昨日姿态校准，今日补录'
  },
  {
    id: 'payload-4',
    name: '科学实验载荷',
    timeSystem: 'UTC',
    startTime: `${dateStr}T14:00:00`,
    endTime: `${dateStr}T18:00:00`,
    powerConsumption: 150,
    planType: 'NORMAL',
    recordType: 'REAL_CHANGE',
    operator: '赵工',
    createdAt: new Date().toISOString(),
    remark: '长时间科学实验'
  },
  {
    id: 'payload-5',
    name: '遥感数据下行',
    timeSystem: 'UTC',
    startTime: `${dateStr}T16:30:00`,
    endTime: `${dateStr}T17:30:00`,
    powerConsumption: 110,
    planType: 'DELAYED',
    recordType: 'REAL_CHANGE',
    operator: '张工',
    createdAt: new Date().toISOString(),
    remark: '计划推迟，原计划15:00开始'
  },
  {
    id: 'payload-6',
    name: '星上计算机自检',
    timeSystem: 'BEIJING',
    startTime: `${yesterdayStr}T23:00:00`,
    endTime: `${yesterdayStr}T23:30:00`,
    powerConsumption: 45,
    planType: 'NORMAL',
    recordType: 'SUPPLEMENT',
    operator: '李工',
    createdAt: new Date().toISOString(),
    remark: '补材料：昨日自检任务'
  }
];

export const mockFaultRecords: FaultRecord[] = [
  {
    id: 'fault-1',
    description: '姿态传感器异常波动',
    timeSystem: 'UTC',
    faultTime: `${dateStr}T03:15:00`,
    duration: 45,
    powerIncrement: 30,
    recordType: 'FAULT_OCCUR',
    operator: '王工',
    createdAt: new Date().toISOString(),
    remark: '姿态控制模式切换导致额外功耗'
  },
  {
    id: 'fault-2',
    description: '太阳能帆板电流异常',
    timeSystem: 'BEIJING',
    faultTime: `${dayBeforeStr}T18:30:00`,
    duration: 120,
    powerIncrement: 0,
    recordType: 'SUPPLEMENT',
    operator: '赵工',
    createdAt: new Date().toISOString(),
    remark: '补录：前日帆板电流波动，无实际功耗影响，已恢复正常'
  },
  {
    id: 'fault-3',
    description: '热控系统临时加电',
    timeSystem: 'UTC',
    faultTime: `${dateStr}T09:00:00`,
    duration: 60,
    powerIncrement: 25,
    recordType: 'FAULT_OCCUR',
    operator: '张工',
    createdAt: new Date().toISOString(),
    remark: '阴影期前热控系统主动加温'
  }
];

export const mockOrbitElements: OrbitElement[] = [
  {
    id: 'orbit-1',
    parameterName: '半长轴',
    timeSystem: 'UTC',
    effectiveTime: `${dateStr}T00:00:00`,
    oldValue: 6878.135,
    newValue: 6878.142,
    isManualChange: true,
    recordType: 'REAL_CHANGE',
    operator: '轨道组',
    createdAt: new Date().toISOString(),
    remark: '手工修正：根据最新测轨数据更新'
  },
  {
    id: 'orbit-2',
    parameterName: 'eclipse',
    timeSystem: 'UTC',
    effectiveTime: `${dateStr}T05:30:00`,
    oldValue: 0,
    newValue: 2100,
    isManualChange: false,
    recordType: 'REAL_CHANGE',
    operator: '轨道组',
    createdAt: new Date().toISOString(),
    remark: '进入地影，持续35分钟'
  },
  {
    id: 'orbit-3',
    parameterName: 'eclipse',
    timeSystem: 'UTC',
    effectiveTime: `${dateStr}T19:45:00`,
    oldValue: 0,
    newValue: 1800,
    isManualChange: false,
    recordType: 'REAL_CHANGE',
    operator: '轨道组',
    createdAt: new Date().toISOString(),
    remark: '进入地影，持续30分钟'
  }
];

export const mockSnapshots: StateSnapshot[] = [
  {
    id: 'snapshot-1',
    timestamp: `${yesterdayStr}T16:00:00.000Z`,
    hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
    payloadData: JSON.stringify(mockPayloadPlans.slice(0, 3)),
    faultData: JSON.stringify(mockFaultRecords.slice(0, 1)),
    orbitData: JSON.stringify(mockOrbitElements.slice(0, 1)),
    operator: '张工',
    description: '昨日白班交接快照'
  },
  {
    id: 'snapshot-2',
    timestamp: `${yesterdayStr}T23:59:00.000Z`,
    hash: 'b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a',
    payloadData: JSON.stringify(mockPayloadPlans.slice(0, 5)),
    faultData: JSON.stringify(mockFaultRecords.slice(0, 2)),
    orbitData: JSON.stringify(mockOrbitElements.slice(0, 2)),
    operator: '李工',
    description: '昨日夜班交接快照'
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    recordType: 'PAYLOAD',
    recordId: 'payload-1',
    action: 'CREATE',
    operator: '张工',
    timestamp: `${dateStr}T08:30:00.000Z`,
    oldValue: '',
    newValue: JSON.stringify(mockPayloadPlans[0]),
    reason: '真修改：新增高分辨率相机成像任务'
  },
  {
    id: 'audit-2',
    recordType: 'PAYLOAD',
    recordId: 'payload-2',
    action: 'UPDATE',
    operator: '李工',
    timestamp: `${dateStr}T09:15:00.000Z`,
    oldValue: JSON.stringify({ ...mockPayloadPlans[1], startTime: `${dateStr}T12:00:00` }),
    newValue: JSON.stringify(mockPayloadPlans[1]),
    reason: '真修改：数据中继传输计划提前'
  },
  {
    id: 'audit-3',
    recordType: 'PAYLOAD',
    recordId: 'payload-3',
    action: 'CREATE',
    operator: '王工',
    timestamp: `${dateStr}T10:00:00.000Z`,
    oldValue: '',
    newValue: JSON.stringify(mockPayloadPlans[2]),
    reason: '补材料：昨日姿态校准任务补录'
  },
  {
    id: 'audit-4',
    recordType: 'FAULT',
    recordId: 'fault-1',
    action: 'CREATE',
    operator: '王工',
    timestamp: `${dateStr}T04:00:00.000Z`,
    oldValue: '',
    newValue: JSON.stringify(mockFaultRecords[0]),
    reason: '真修改：记录姿态传感器异常'
  },
  {
    id: 'audit-5',
    recordType: 'ORBIT',
    recordId: 'orbit-1',
    action: 'CREATE',
    operator: '轨道组',
    timestamp: `${dateStr}T01:30:00.000Z`,
    oldValue: '',
    newValue: JSON.stringify(mockOrbitElements[0]),
    reason: '真修改：手工修正轨道根数'
  }
];
