import type {
  ContainerSlot,
  Crane,
  Truck,
  Conflict,
  TimelineEvent,
  SavedScenario,
  DataSourceInfo,
  ContainerType,
} from '@/types';

const now = new Date();

const containerNumbers = [
  'MSKU1234567', 'MSKU7654321', 'MAEU9876543', 'MAEU3456789',
  'CMAU1112223', 'CMAU3334445', 'HLCU5556667', 'HLCU7778889',
  'OOLU9990001', 'OOLU2223334', 'YMLU5556667', 'YMLU8889990',
];

const containerTypes: ContainerType[] = ['dry', 'reefer', 'hazardous'];

function generateContainerSlots(): ContainerSlot[] {
  const slots: ContainerSlot[] = [];
  const bays = 6;
  const rows = 4;
  const tiers = 3;

  for (let bay = 0; bay < bays; bay++) {
    for (let row = 0; row < rows; row++) {
      for (let tier = 0; tier < tiers; tier++) {
        const isOccupied = Math.random() > 0.3;
        const id = `slot-${bay}-${row}-${tier}`;
        
        slots.push({
          id,
          bay,
          row,
          tier,
          position: {
            x: bay * 3 - (bays * 3) / 2,
            y: tier * 1.5,
            z: row * 3 - (rows * 3) / 2,
          },
          size: Math.random() > 0.5 ? '20ft' : '40ft',
          status: isOccupied ? 'occupied' : 'empty',
          container: isOccupied
            ? {
                id: `container-${id}`,
                number: containerNumbers[Math.floor(Math.random() * containerNumbers.length)],
                type: containerTypes[Math.floor(Math.random() * containerTypes.length)],
                weight: Math.floor(Math.random() * 20000) + 5000,
                arrivalTime: new Date(now.getTime() - Math.random() * 86400000 * 3),
                departureTime: new Date(now.getTime() + Math.random() * 86400000 * 5),
              }
            : undefined,
          lastUpdated: new Date(),
          dataSource: '箱位模型_20240115.xlsx',
        });
      }
    }
  }
  return slots;
}

export const mockContainerSlots: ContainerSlot[] = generateContainerSlots();

export const mockCranes: Crane[] = [
  {
    id: 'crane-1',
    name: '吊机 A-01',
    position: { x: -6, y: 6, z: 0 },
    status: 'working',
    workingRange: { minX: -12, maxX: -3, minZ: -6, maxZ: 6 },
    lastUpdated: new Date(),
    dataSource: '吊机任务_20240115.csv',
    currentTask: {
      id: 'task-1',
      craneId: 'crane-1',
      type: 'load',
      targetSlot: 'slot-0-1-0',
      containerNumber: 'MSKU1234567',
      startTime: new Date(now.getTime() - 1800000),
      endTime: new Date(now.getTime() + 1800000),
      priority: 1,
      dataSource: '吊机任务_20240115.csv',
    },
  },
  {
    id: 'crane-2',
    name: '吊机 B-02',
    position: { x: 0, y: 6, z: 3 },
    status: 'working',
    workingRange: { minX: -3, maxX: 3, minZ: -6, maxZ: 6 },
    lastUpdated: new Date(),
    dataSource: '吊机任务_20240115.csv',
    currentTask: {
      id: 'task-2',
      craneId: 'crane-2',
      type: 'move',
      sourceSlot: 'slot-3-2-1',
      targetSlot: 'slot-2-0-0',
      containerNumber: 'MAEU9876543',
      startTime: new Date(now.getTime() - 900000),
      endTime: new Date(now.getTime() + 2700000),
      priority: 2,
      dataSource: '吊机任务_20240115.csv',
    },
  },
  {
    id: 'crane-3',
    name: '吊机 C-03',
    position: { x: 6, y: 6, z: -3 },
    status: 'idle',
    workingRange: { minX: 3, maxX: 12, minZ: -6, maxZ: 6 },
    lastUpdated: new Date(),
    dataSource: '吊机任务_20240115.csv',
  },
];

export const mockTrucks: Truck[] = [
  {
    id: 'truck-1',
    plateNumber: '沪A12345',
    position: { x: -10, y: 0, z: -2 },
    status: 'moving',
    lastUpdated: new Date(),
    dataSource: '卡车路线_20240115.json',
    currentRoute: {
      id: 'route-1',
      truckId: 'truck-1',
      startTime: new Date(now.getTime() - 300000),
      endTime: new Date(now.getTime() + 600000),
      dataSource: '卡车路线_20240115.json',
      waypoints: [
        { x: -15, y: 0, z: -2, timestamp: new Date(now.getTime() - 300000) },
        { x: -8, y: 0, z: -2, timestamp: new Date(now.getTime() - 120000) },
        { x: -5, y: 0, z: 0, timestamp: new Date(now.getTime() + 60000) },
        { x: 0, y: 0, z: 0, timestamp: new Date(now.getTime() + 300000) },
      ],
    },
  },
  {
    id: 'truck-2',
    plateNumber: '沪B67890',
    position: { x: 8, y: 0, z: 4 },
    status: 'loading',
    lastUpdated: new Date(),
    dataSource: '卡车路线_20240115.json',
  },
  {
    id: 'truck-3',
    plateNumber: '沪C54321',
    position: { x: 12, y: 0, z: -4 },
    status: 'waiting',
    lastUpdated: new Date(),
    dataSource: '卡车路线_20240115.json',
  },
  {
    id: 'truck-4',
    plateNumber: '沪D98765',
    position: { x: 5, y: 0, z: -5 },
    status: 'moving',
    lastUpdated: new Date(),
    dataSource: '卡车路线_20240115.json',
    currentRoute: {
      id: 'route-2',
      truckId: 'truck-4',
      startTime: new Date(now.getTime() - 600000),
      endTime: new Date(now.getTime() + 300000),
      dataSource: '卡车路线_20240115.json',
      waypoints: [
        { x: 15, y: 0, z: -5, timestamp: new Date(now.getTime() - 600000) },
        { x: 10, y: 0, z: -5, timestamp: new Date(now.getTime() - 300000) },
        { x: 5, y: 0, z: -5, timestamp: new Date() },
        { x: 0, y: 0, z: -5, timestamp: new Date(now.getTime() + 300000) },
      ],
    },
  },
];

export const mockConflicts: Conflict[] = [
  {
    id: 'conflict-1',
    type: 'slot_overlap',
    severity: 'critical',
    title: '箱位重叠冲突',
    description: 'Slot-2-1-0 和 Slot-2-1-1 检测到空间重叠。两个40ft集装箱被分配到相邻但空间重叠的位置。请检查箱位模型数据更新是否正确。',
    affectedObjects: ['slot-2-1-0', 'slot-2-1-1'],
    affectedObjectNames: ['箱位 2-1-0 (MAEU9876543)', '箱位 2-1-1 (CMAU1112223)'],
    timestamp: new Date(now.getTime() - 3600000),
    dataSource: ['箱位模型_20240115.xlsx', '作业备注_20240115.txt'],
    resolved: false,
  },
  {
    id: 'conflict-2',
    type: 'crane_collision',
    severity: 'warning',
    title: '吊机作业范围冲突',
    description: '吊机 A-01 和吊机 B-02 的工作范围在 X=-3 处有重叠区域。当前任务可能导致操作干涉，建议调整作业顺序。',
    affectedObjects: ['crane-1', 'crane-2'],
    affectedObjectNames: ['吊机 A-01', '吊机 B-02'],
    timestamp: new Date(now.getTime() - 1800000),
    dataSource: ['吊机任务_20240115.csv'],
    resolved: false,
  },
  {
    id: 'conflict-3',
    type: 'route_blockage',
    severity: 'warning',
    title: '卡车路线堵塞',
    description: 'Truck-1 和 Truck-4 的路线在 X=0, Z=-3 处预计于14:30交汇。可能造成堆场入口堵塞，建议调度其中一辆卡车等待。',
    affectedObjects: ['truck-1', 'truck-4'],
    affectedObjectNames: ['卡车 沪A12345', '卡车 沪D98765'],
    timestamp: new Date(now.getTime() - 900000),
    dataSource: ['卡车路线_20240115.json', '调度报告_20240115.pdf'],
    resolved: false,
  },
  {
    id: 'conflict-4',
    type: 'port_congestion',
    severity: 'critical',
    title: '压港风险预警',
    description: '当前堆场利用率达到 85%，预计未来 24 小时内将有 3 艘货轮到港，共计 1200 TEU 卸载量。如不加快疏港，将面临严重压港风险。',
    affectedObjects: [],
    affectedObjectNames: ['全堆场'],
    timestamp: new Date(now.getTime() - 600000),
    dataSource: ['船期表_20240115.xlsx', '调度报告_20240115.pdf'],
    resolved: false,
  },
];

export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: 'event-1',
    timestamp: new Date(now.getTime() - 7200000),
    type: 'crane_start',
    title: '吊机 A-01 开始作业',
    description: '开始卸载 MSKU1234567',
    relatedObjectId: 'crane-1',
  },
  {
    id: 'event-2',
    timestamp: new Date(now.getTime() - 3600000),
    type: 'conflict',
    title: '检测到箱位重叠',
    description: '系统自动检测到空间冲突',
    relatedObjectId: 'conflict-1',
  },
  {
    id: 'event-3',
    timestamp: new Date(now.getTime() - 1800000),
    type: 'truck_arrival',
    title: '卡车 沪A12345 到达',
    description: '前往 A 区装载区',
    relatedObjectId: 'truck-1',
  },
  {
    id: 'event-4',
    timestamp: new Date(now.getTime() - 900000),
    type: 'crane_start',
    title: '吊机 B-02 移箱作业',
    description: 'MAEU9876543 从 3-2-1 移至 2-0-0',
    relatedObjectId: 'crane-2',
  },
  {
    id: 'event-5',
    timestamp: new Date(now.getTime() + 1800000),
    type: 'crane_end',
    title: '吊机 A-01 预计完成',
    description: 'MSKU1234567 卸载完成',
    relatedObjectId: 'crane-1',
  },
  {
    id: 'event-6',
    timestamp: new Date(now.getTime() + 7200000),
    type: 'truck_departure',
    title: '预计船舶到港',
    description: '中远之星 预计到港',
    relatedObjectId: 'ship-1',
  },
];

export const mockSavedScenarios: SavedScenario[] = [
  {
    id: 'scenario-1',
    name: '早高峰调度方案',
    description: '针对 08:00-12:00 早高峰的优化调度方案，包含卡车路线重排和吊机任务分配',
    createdAt: new Date(now.getTime() - 86400000 * 2),
    cameraPosition: { x: 0, y: 15, z: 20 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    filters: {
      containerTypes: [],
      slotStatuses: ['occupied'],
      craneStatuses: [],
      truckStatuses: [],
      timeRange: null,
      showConflictsOnly: true,
      conflictTypes: ['port_congestion'],
    },
    selectedObjects: ['crane-1', 'crane-2'],
  },
  {
    id: 'scenario-2',
    name: '压港应急方案',
    description: '应对下周船舶集中到港的应急预案，包含临时堆放区启用和外部堆场协调',
    createdAt: new Date(now.getTime() - 86400000),
    cameraPosition: { x: -10, y: 12, z: 15 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    filters: {
      containerTypes: [],
      slotStatuses: [],
      craneStatuses: [],
      truckStatuses: [],
      timeRange: null,
      showConflictsOnly: false,
      conflictTypes: [],
    },
    selectedObjects: [],
  },
];

export const mockDataSources: DataSourceInfo[] = [
  { name: '箱位模型_20240115.xlsx', lastImport: new Date(now.getTime() - 3600000), recordCount: 72 },
  { name: '吊机任务_20240115.csv', lastImport: new Date(now.getTime() - 1800000), recordCount: 15 },
  { name: '卡车路线_20240115.json', lastImport: new Date(now.getTime() - 900000), recordCount: 8 },
  { name: '船期表_20240115.xlsx', lastImport: new Date(now.getTime() - 7200000), recordCount: 12 },
  { name: '作业备注_20240115.txt', lastImport: new Date(now.getTime() - 5400000), recordCount: 24 },
  { name: '调度报告_20240115.pdf', lastImport: new Date(now.getTime() - 10800000), recordCount: 1 },
];
