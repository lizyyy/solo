import dayjs from 'dayjs';

export const sampleData = {
  rooms: [
    {
      id: 'room-001',
      name: '古墓迷踪',
      status: 'warning',
      hasMaintenance: false,
      devices: [
        { id: 'dev-001', name: '石门机关', type: 'door_sensor', x: 50, y: 30 },
        { id: 'dev-002', name: '铜镜密码', type: 'touch_sensor', x: 120, y: 80 },
        { id: 'dev-003', name: '石棺压力板', type: 'pressure_sensor', x: 200, y: 50 },
        { id: 'dev-004', name: '火把传感器', type: 'light_sensor', x: 80, y: 150 }
      ],
      layout: {
        width: 300,
        height: 200,
        walls: [
          { x1: 0, y1: 0, x2: 300, y2: 0 },
          { x1: 0, y1: 200, x2: 300, y2: 200 },
          { x1: 0, y1: 0, x2: 0, y2: 200 },
          { x1: 300, y1: 0, x2: 300, y2: 200 },
          { x1: 100, y1: 0, x2: 100, y2: 120 }
        ]
      }
    },
    {
      id: 'room-002',
      name: '银行金库',
      status: 'normal',
      hasMaintenance: true,
      maintenanceDate: dayjs().add(1, 'day').toISOString(),
      devices: [
        { id: 'dev-005', name: '保险柜密码', type: 'keypad', x: 60, y: 40 },
        { id: 'dev-006', name: '激光矩阵', type: 'beam_sensor', x: 150, y: 100 },
        { id: 'dev-007', name: '指纹锁', type: 'fingerprint_sensor', x: 250, y: 60 }
      ],
      layout: {
        width: 350,
        height: 180,
        walls: [
          { x1: 0, y1: 0, x2: 350, y2: 0 },
          { x1: 0, y1: 180, x2: 350, y2: 180 },
          { x1: 0, y1: 0, x2: 0, y2: 180 },
          { x1: 350, y1: 0, x2: 350, y2: 180 }
        ]
      }
    },
    {
      id: 'room-003',
      name: '太空舱',
      status: 'error',
      hasMaintenance: false,
      devices: [
        { id: 'dev-008', name: '控制台旋钮', type: 'dial_sensor', x: 100, y: 80 },
        { id: 'dev-009', name: '氧气阀门', type: 'valve_sensor', x: 220, y: 50 },
        { id: 'dev-010', name: '逃生舱按钮', type: 'button_sensor', x: 300, y: 120 },
        { id: 'dev-011', name: '舷窗传感器', type: 'window_sensor', x: 180, y: 160 }
      ],
      layout: {
        width: 400,
        height: 220,
        walls: [
          { x1: 0, y1: 0, x2: 400, y2: 0 },
          { x1: 0, y1: 220, x2: 400, y2: 220 },
          { x1: 0, y1: 0, x2: 0, y2: 220 },
          { x1: 400, y1: 0, x2: 400, y2: 220 },
          { x1: 150, y1: 0, x2: 150, y2: 100 },
          { x1: 280, y1: 120, x2: 280, y2: 220 }
        ]
      }
    }
  ],
  sensors: [
    {
      id: 'sensor-001',
      roomId: 'room-001',
      deviceId: 'dev-001',
      type: 'trigger',
      timestamp: dayjs().subtract(2, 'hour').toISOString(),
      isReset: false,
      notes: '玩家触发'
    },
    {
      id: 'sensor-002',
      roomId: 'room-001',
      deviceId: 'dev-001',
      type: 'trigger',
      timestamp: dayjs().subtract(2, 'hour').add(2, 'minute').toISOString(),
      isReset: false,
      notes: '玩家再次触发'
    },
    {
      id: 'sensor-003',
      roomId: 'room-001',
      deviceId: 'dev-001',
      type: 'trigger',
      timestamp: dayjs().subtract(2, 'hour').add(4, 'minute').toISOString(),
      isReset: false,
      notes: '连续触发，疑似卡关'
    },
    {
      id: 'sensor-004',
      roomId: 'room-001',
      deviceId: 'dev-002',
      type: 'trigger',
      timestamp: dayjs().subtract(1, 'hour').add(30, 'minute').toISOString(),
      isReset: false,
      notes: '玩家触发'
    },
    {
      id: 'sensor-005',
      roomId: 'room-001',
      deviceId: 'dev-002',
      type: 'reset',
      timestamp: dayjs().subtract(1, 'hour').add(35, 'minute').toISOString(),
      isReset: true,
      notes: '正常复位'
    },
    {
      id: 'sensor-006',
      roomId: 'room-003',
      deviceId: 'dev-008',
      type: 'trigger',
      timestamp: dayjs().subtract(3, 'hour').toISOString(),
      isReset: false,
      notes: '玩家触发'
    },
    {
      id: 'sensor-007',
      roomId: 'room-003',
      deviceId: 'dev-008',
      type: 'trigger',
      timestamp: dayjs().subtract(3, 'hour').add(1, 'minute').toISOString(),
      isReset: false,
      notes: '快速连续触发'
    },
    {
      id: 'sensor-008',
      roomId: 'room-003',
      deviceId: 'dev-008',
      type: 'trigger',
      timestamp: dayjs().subtract(3, 'hour').add(2, 'minute').toISOString(),
      isReset: false,
      notes: '连续触发'
    },
    {
      id: 'sensor-009',
      roomId: 'room-003',
      deviceId: 'dev-009',
      type: 'trigger',
      timestamp: dayjs().subtract(2, 'hour').toISOString(),
      isReset: false,
      notes: '玩家触发后未复位'
    },
    {
      id: 'sensor-010',
      roomId: 'room-002',
      deviceId: 'dev-005',
      type: 'trigger',
      timestamp: dayjs().subtract(4, 'hour').toISOString(),
      isReset: false,
      notes: '玩家触发'
    },
    {
      id: 'sensor-011',
      roomId: 'room-002',
      deviceId: 'dev-005',
      type: 'reset',
      timestamp: dayjs().subtract(4, 'hour').add(10, 'minute').toISOString(),
      isReset: true,
      notes: '正常复位'
    }
  ],
  batteries: [
    {
      id: 'battery-001',
      roomId: 'room-001',
      deviceId: 'dev-004',
      deviceName: '火把传感器',
      percentage: 15,
      lastChecked: dayjs().subtract(1, 'day').toISOString()
    },
    {
      id: 'battery-002',
      roomId: 'room-002',
      deviceId: 'dev-007',
      deviceName: '指纹锁',
      percentage: 85,
      lastChecked: dayjs().subtract(2, 'day').toISOString()
    },
    {
      id: 'battery-003',
      roomId: 'room-003',
      deviceId: 'dev-010',
      deviceName: '逃生舱按钮',
      percentage: 8,
      lastChecked: dayjs().subtract(3, 'day').toISOString()
    },
    {
      id: 'battery-004',
      roomId: 'room-003',
      deviceId: 'dev-011',
      deviceName: '舷窗传感器',
      percentage: 45,
      lastChecked: dayjs().subtract(1, 'day').toISOString()
    }
  ],
  reservations: [
    {
      id: 'res-001',
      roomId: 'room-001',
      date: dayjs().add(1, 'day').toISOString(),
      timeSlot: '10:00-11:30',
      count: 6,
      customerName: '张先生团队'
    },
    {
      id: 'res-002',
      roomId: 'room-002',
      date: dayjs().add(1, 'day').toISOString(),
      timeSlot: '14:00-15:30',
      count: 4,
      customerName: '李小姐团队'
    },
    {
      id: 'res-003',
      roomId: 'room-003',
      date: dayjs().add(1, 'day').toISOString(),
      timeSlot: '19:00-20:30',
      count: 8,
      customerName: '公司团建'
    },
    {
      id: 'res-004',
      roomId: 'room-001',
      date: dayjs().add(1, 'day').toISOString(),
      timeSlot: '20:00-21:30',
      count: 5,
      customerName: '王同学团队'
    }
  ]
};
