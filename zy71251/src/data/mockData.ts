import type { Warehouse, Shelf, Location, ForbiddenZone, Task, Artwork, ArtBox, SensorData } from '../types';

const artworkNames = [
  '山水长卷', '富春山居图摹本', '墨竹图', '秋林放犊图', '寒江独钓',
  '城市夜景', '星空下的麦田', '抽象系列No.3', '人物肖像习作', '静物与花瓶',
  '记忆的永恒', '时间的碎片', '空间的回响', '光与影的对话', '色彩的韵律',
  '敦煌飞天壁画摹本', '清明上河图局部', '千里江山图节选', '八骏图', '松鹤延年'
];

const artists = [
  '张大千', '齐白石', '徐悲鸿', '潘天寿', '林风眠',
  '吴冠中', '傅抱石', '李可染', '黄宾虹', '刘海粟',
  'Van Gogh', 'Picasso', 'Monet', 'Dali', 'Warhol'
];

const generateArtworks = (count: number): Artwork[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `ART-${String(10001 + i).padStart(6, '0')}`,
    name: artworkNames[i % artworkNames.length] + (i >= artworkNames.length ? ` ${Math.floor(i / artworkNames.length) + 1}` : ''),
    artist: artists[Math.floor(Math.random() * artists.length)],
    type: (['oil', 'chinese', 'sculpture', 'photography', 'mixed'] as const)[Math.floor(Math.random() * 5)],
    year: 1900 + Math.floor(Math.random() * 124),
    size: `${60 + Math.floor(Math.random() * 100)}×${80 + Math.floor(Math.random() * 120)}cm`,
    condition: (['excellent', 'good', 'fair', 'needs_repair'] as const)[Math.floor(Math.random() * 4)],
    value: Math.floor(Math.random() * 9000000) + 100000,
    accessionNumber: `AC-${String(2020 + Math.floor(Math.random() * 5)).slice(-2)}-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`
  }));
};

const generateSensorHistory = (baseTemp: number, baseHumid: number, hasAlert: boolean) => {
  const history = [];
  for (let i = 24; i >= 0; i--) {
    const time = new Date(Date.now() - i * 3600000);
    let temp = baseTemp + (Math.random() - 0.5) * 3;
    let humid = baseHumid + (Math.random() - 0.5) * 10;
    if (hasAlert && i < 6) {
      temp = 26 + Math.random() * 3;
      humid = 65 + Math.random() * 10;
    }
    history.push({
      time: time.toISOString(),
      temp: Math.round(temp * 10) / 10,
      humidity: Math.round(humid * 10) / 10
    });
  }
  return history;
};

export const warehouse: Warehouse = {
  id: 'WH-001',
  name: '东方艺术中心典藏库',
  dimensions: { width: 40, depth: 30, height: 8 }
};

export const shelves: Shelf[] = [
  { id: 'S-A01', code: 'A-01', position: { x: -15, z: -10 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-A02', code: 'A-02', position: { x: -15, z: 0 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-A03', code: 'A-03', position: { x: -15, z: 10 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-B01', code: 'B-01', position: { x: -5, z: -10 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-B02', code: 'B-02', position: { x: -5, z: 0 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-B03', code: 'B-03', position: { x: -5, z: 10 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-C01', code: 'C-01', position: { x: 5, z: -10 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-C02', code: 'C-02', position: { x: 5, z: 0 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-C03', code: 'C-03', position: { x: 5, z: 10 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-D01', code: 'D-01', position: { x: 15, z: -10 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-D02', code: 'D-02', position: { x: 15, z: 0 }, levels: 4, positionsPerLevel: 5 },
  { id: 'S-D03', code: 'D-03', position: { x: 15, z: 10 }, levels: 4, positionsPerLevel: 5 }
];

const allArtworks = generateArtworks(80);

const generateSensorData = (locationId: string, isAlert: boolean): SensorData => {
  const baseTemp = isAlert ? 27 : 20 + Math.random() * 4;
  const baseHumid = isAlert ? 68 : 45 + Math.random() * 10;
  const history = generateSensorHistory(baseTemp, baseHumid, isAlert);
  
  const alerts: SensorData['alerts'] = [];
  if (isAlert || baseTemp > 25) {
    alerts.push({ type: 'temp_high', level: baseTemp > 27 ? 'critical' : 'warning' });
  }
  if (isAlert || baseHumid > 60) {
    alerts.push({ type: 'humid_high', level: baseHumid > 65 ? 'critical' : 'warning' });
  }
  
  return {
    locationId,
    temperature: Math.round(baseTemp * 10) / 10,
    humidity: Math.round(baseHumid * 10) / 10,
    lastUpdate: new Date().toISOString(),
    history,
    alerts
  };
};

export const locations: Location[] = shelves.flatMap(shelf => {
  const shelfLocations: Location[] = [];
  for (let level = 1; level <= shelf.levels; level++) {
    for (let pos = 1; pos <= shelf.positionsPerLevel; pos++) {
      const locId = `${shelf.id}-L${level}-P${pos}`;
      const code = `${shelf.code}-L${level}-P${String(pos).padStart(2, '0')}`;
      const isOccupied = Math.random() > 0.25;
      const isMaintenance = Math.random() > 0.95;
      const isConstantTemp = shelf.code.startsWith('D');
      const isValuables = shelf.code.startsWith('A') && level === 1;
      
      const hasTempAlert = (shelf.code === 'B-02' && level === 2) || 
                          (shelf.code === 'C-01' && level === 3) ||
                          (shelf.code === 'D-03' && level === 1);
      
      const worldPos = {
        x: shelf.position.x + (pos - (shelf.positionsPerLevel + 1) / 2) * 1.2,
        y: level * 1.8 - 0.5,
        z: shelf.position.z
      };
      
      const location: Location = {
        id: locId,
        shelfId: shelf.id,
        level,
        position: pos,
        code,
        status: isMaintenance ? 'maintenance' : isOccupied ? 'occupied' : 'empty',
        zone: isValuables ? 'valuables' : isConstantTemp ? 'constant_temp' : 'normal',
        worldPosition: worldPos,
        sensor: generateSensorData(locId, hasTempAlert)
      };
      
      if (isOccupied && !isMaintenance) {
        const artworkCount = Math.floor(Math.random() * 3) + 1;
        const startIdx = Math.floor(Math.random() * (allArtworks.length - artworkCount));
        const boxArtworks = allArtworks.slice(startIdx, startIdx + artworkCount);
        
        location.box = {
          id: `BX-${locId}`,
          code: `BX-${String(2024000 + Math.floor(Math.random() * 10000))}`,
          locationId: locId,
          artworks: boxArtworks,
          inDate: new Date(Date.now() - Math.random() * 365 * 24 * 3600000).toISOString().split('T')[0],
          handler: ['张管理员', '李典藏', '王组长', '陈助理'][Math.floor(Math.random() * 4)],
          notes: Math.random() > 0.7 ? '需轻拿轻放，定期检查' : undefined,
          status: 'in_stock',
          material: (['wood', 'metal', 'custom'] as const)[Math.floor(Math.random() * 3)],
          weight: Math.round((15 + Math.random() * 25) * 10) / 10
        };
      }
      
      shelfLocations.push(location);
    }
  }
  return shelfLocations;
});

locations[15].status = 'occupied';
locations[15].box = locations[35].box;
if (locations[35].box) {
  locations[35].box.locationId = locations[15].id;
}

export const forbiddenZones: ForbiddenZone[] = [
  {
    id: 'FZ-001',
    name: '设备机房区',
    points: [{ x: -20, z: -15 }, { x: -18, z: -15 }, { x: -18, z: -5 }, { x: -20, z: -5 }],
    reason: '电气设备区域，非授权人员禁止进入',
    color: '#EF4444'
  },
  {
    id: 'FZ-002',
    name: '精密仪器存储区',
    points: [{ x: 18, z: -5 }, { x: 20, z: -5 }, { x: 20, z: 5 }, { x: 18, z: 5 }],
    reason: '存放精密修复设备，需专业操作',
    color: '#F59E0B'
  },
  {
    id: 'FZ-003',
    name: '消防通道',
    points: [{ x: -2, z: 14 }, { x: 2, z: 14 }, { x: 2, z: 16 }, { x: -2, z: 16 }],
    reason: '消防通道，严禁占用',
    color: '#EF4444'
  }
];

export const tasks: Task[] = [
  {
    id: 'TASK-2024-001',
    type: 'outbound',
    boxId: locations[10].box?.id || '',
    fromLocation: locations[10].id,
    toLocation: 'EXIT-01',
    status: 'in_progress',
    route: [
      { x: -15, y: 0, z: -10 },
      { x: -10, y: 0, z: -10 },
      { x: 0, y: 0, z: -10 },
      { x: 0, y: 0, z: -12 }
    ],
    hasForbiddenCrossing: false,
    createTime: new Date(Date.now() - 3600000).toISOString(),
    operator: '张管理员',
    operationLog: [
      { action: '任务创建', time: new Date(Date.now() - 3600000).toISOString(), operator: '李典藏', remark: '春季展览出库' },
      { action: '开始执行', time: new Date(Date.now() - 1800000).toISOString(), operator: '张管理员', remark: '已确认库位' }
    ],
    priority: 'urgent'
  },
  {
    id: 'TASK-2024-002',
    type: 'transfer',
    boxId: locations[45].box?.id || '',
    fromLocation: locations[45].id,
    toLocation: locations[85].id,
    status: 'pending',
    route: [
      { x: -5, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -8 },
      { x: 18, y: 0, z: -8 }
    ],
    hasForbiddenCrossing: true,
    createTime: new Date(Date.now() - 7200000).toISOString(),
    operator: '李典藏',
    operationLog: [
      { action: '任务创建', time: new Date(Date.now() - 7200000).toISOString(), operator: '李典藏', remark: '调整至恒温区' },
      { action: '路线告警', time: new Date(Date.now() - 7100000).toISOString(), operator: '系统', remark: '检测到穿越禁区' }
    ],
    priority: 'normal'
  },
  {
    id: 'TASK-2024-003',
    type: 'inbound',
    boxId: 'BX-NEW-001',
    fromLocation: 'ENTRANCE-01',
    toLocation: locations[60].id,
    status: 'pending',
    route: [
      { x: 0, y: 0, z: -12 },
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 }
    ],
    hasForbiddenCrossing: false,
    createTime: new Date(Date.now() - 1800000).toISOString(),
    operator: '王组长',
    operationLog: [
      { action: '任务创建', time: new Date(Date.now() - 1800000).toISOString(), operator: '王组长', remark: '新征集作品入库' }
    ],
    priority: 'normal'
  }
];

export const operationLogs = [
  { action: '系统启动', time: new Date(Date.now() - 86400000).toISOString(), operator: '系统' },
  { action: '温湿度校准', time: new Date(Date.now() - 43200000).toISOString(), operator: '张管理员' },
  { action: '入库登记', time: new Date(Date.now() - 28800000).toISOString(), operator: '李典藏', remark: 'BX-2024-00897' },
  { action: '补录登记', time: new Date(Date.now() - 14400000).toISOString(), operator: '陈助理', remark: '补录2024-01-15入库记录' },
  { action: '撤回操作', time: new Date(Date.now() - 7200000).toISOString(), operator: '王组长', remark: '撤回错误库位分配' }
];
