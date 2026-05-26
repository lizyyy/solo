export const LEVELS = [
  {
    id: 1,
    name: '关卡 1: 平稳运行',
    description: '冷库正常运行，只需处理常规除霜和少量出入库任务',
    initialDefrosts: [
      { evaporatorId: 1, start: 120, duration: 20 },
      { evaporatorId: 2, start: 200, duration: 20 },
      { evaporatorId: 3, start: 280, duration: 15 }
    ],
    tasks: [
      { id: 'T1', name: '猪肉入库', type: 'inbound', zone: 'A', windowStart: 60, windowEnd: 120, duration: 15 },
      { id: 'T2', name: '蔬菜出库', type: 'outbound', zone: 'C', windowStart: 180, windowEnd: 240, duration: 10 },
      { id: 'T3', name: '水果入库', type: 'inbound', zone: 'C', windowStart: 300, windowEnd: 360, duration: 12 },
      { id: 'T4', name: '肉类出库', type: 'outbound', zone: 'A', windowStart: 420, windowEnd: 480, duration: 15 },
      { id: 'T5', name: '乳制品入库', type: 'inbound', zone: 'B', windowStart: 500, windowEnd: 560, duration: 10 }
    ],
    challenge: 'easy'
  },
  {
    id: 2,
    name: '关卡 2: 任务繁忙',
    description: '出入库任务增多，需要合理安排除霜避免冲突',
    initialDefrosts: [
      { evaporatorId: 1, start: 100, duration: 25 },
      { evaporatorId: 2, start: 160, duration: 25 },
      { evaporatorId: 3, start: 220, duration: 20 }
    ],
    tasks: [
      { id: 'T1', name: '猪肉入库', type: 'inbound', zone: 'A', windowStart: 40, windowEnd: 100, duration: 15 },
      { id: 'T2', name: '牛肉出库', type: 'outbound', zone: 'A', windowStart: 90, windowEnd: 150, duration: 12 },
      { id: 'T3', name: '蔬菜入库', type: 'inbound', zone: 'B', windowStart: 140, windowEnd: 200, duration: 15 },
      { id: 'T4', name: '水果出库', type: 'outbound', zone: 'C', windowStart: 180, windowEnd: 240, duration: 10 },
      { id: 'T5', name: '海鲜入库', type: 'inbound', zone: 'A', windowStart: 260, windowEnd: 320, duration: 18 },
      { id: 'T6', name: '乳制品出库', type: 'outbound', zone: 'B', windowStart: 340, windowEnd: 400, duration: 12 },
      { id: 'T7', name: '熟食入库', type: 'inbound', zone: 'C', windowStart: 380, windowEnd: 440, duration: 10 },
      { id: 'T8', name: '肉类出库', type: 'outbound', zone: 'A', windowStart: 450, windowEnd: 510, duration: 15 }
    ],
    challenge: 'medium'
  },
  {
    id: 3,
    name: '关卡 3: 高温危机',
    description: '冷库负荷增大，温度控制困难，需频繁除霜',
    initialDefrosts: [
      { evaporatorId: 1, start: 80, duration: 30 },
      { evaporatorId: 2, start: 140, duration: 30 },
      { evaporatorId: 3, start: 200, duration: 25 }
    ],
    tasks: [
      { id: 'T1', name: '猪肉入库', type: 'inbound', zone: 'A', windowStart: 30, windowEnd: 80, duration: 18 },
      { id: 'T2', name: '牛肉出库', type: 'outbound', zone: 'A', windowStart: 70, windowEnd: 130, duration: 15 },
      { id: 'T3', name: '海鲜入库', type: 'inbound', zone: 'A', windowStart: 120, windowEnd: 180, duration: 20 },
      { id: 'T4', name: '蔬菜入库', type: 'inbound', zone: 'B', windowStart: 160, windowEnd: 220, duration: 15 },
      { id: 'T5', name: '水果出库', type: 'outbound', zone: 'C', windowStart: 200, windowEnd: 260, duration: 12 },
      { id: 'T6', name: '乳制品入库', type: 'inbound', zone: 'B', windowStart: 240, windowEnd: 300, duration: 15 },
      { id: 'T7', name: '熟食出库', type: 'outbound', zone: 'C', windowStart: 290, windowEnd: 350, duration: 12 },
      { id: 'T8', name: '肉类出库', type: 'outbound', zone: 'A', windowStart: 340, windowEnd: 400, duration: 18 },
      { id: 'T9', name: '蔬菜出库', type: 'outbound', zone: 'B', windowStart: 390, windowEnd: 450, duration: 15 },
      { id: 'T10', name: '海鲜出库', type: 'outbound', zone: 'A', windowStart: 440, windowEnd: 500, duration: 18 }
    ],
    challenge: 'hard'
  },
  {
    id: 4,
    name: '关卡 4: 极端考验',
    description: '任务密集且时间窗紧张，需要精确调度',
    initialDefrosts: [
      { evaporatorId: 1, start: 60, duration: 25 },
      { evaporatorId: 2, start: 120, duration: 25 },
      { evaporatorId: 3, start: 180, duration: 20 }
    ],
    tasks: [
      { id: 'T1', name: '猪肉入库', type: 'inbound', zone: 'A', windowStart: 10, windowEnd: 60, duration: 20 },
      { id: 'T2', name: '牛肉入库', type: 'inbound', zone: 'A', windowStart: 50, windowEnd: 100, duration: 18 },
      { id: 'T3', name: '牛肉出库', type: 'outbound', zone: 'A', windowStart: 90, windowEnd: 140, duration: 15 },
      { id: 'T4', name: '海鲜入库', type: 'inbound', zone: 'A', windowStart: 130, windowEnd: 180, duration: 18 },
      { id: 'T5', name: '蔬菜入库', type: 'inbound', zone: 'B', windowStart: 170, windowEnd: 220, duration: 15 },
      { id: 'T6', name: '乳制品入库', type: 'inbound', zone: 'B', windowStart: 210, windowEnd: 260, duration: 12 },
      { id: 'T7', name: '乳制品出库', type: 'outbound', zone: 'B', windowStart: 250, windowEnd: 300, duration: 10 },
      { id: 'T8', name: '水果入库', type: 'inbound', zone: 'C', windowStart: 190, windowEnd: 240, duration: 12 },
      { id: 'T9', name: '水果出库', type: 'outbound', zone: 'C', windowStart: 240, windowEnd: 290, duration: 10 },
      { id: 'T10', name: '熟食入库', type: 'inbound', zone: 'C', windowStart: 280, windowEnd: 330, duration: 12 },
      { id: 'T11', name: '熟食出库', type: 'outbound', zone: 'C', windowStart: 320, windowEnd: 370, duration: 10 },
      { id: 'T12', name: '肉类出库', type: 'outbound', zone: 'A', windowStart: 310, windowEnd: 360, duration: 15 },
      { id: 'T13', name: '蔬菜出库', type: 'outbound', zone: 'B', windowStart: 360, windowEnd: 410, duration: 12 },
      { id: 'T14', name: '海鲜出库', type: 'outbound', zone: 'A', windowStart: 400, windowEnd: 460, duration: 18 },
      { id: 'T15', name: '紧急出库', type: 'outbound', zone: 'A', windowStart: 450, windowEnd: 500, duration: 15 }
    ],
    challenge: 'extreme'
  }
];