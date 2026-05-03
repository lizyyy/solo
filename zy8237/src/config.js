export const CONFIG = {
  CAR_SIZE: { width: 2.0, height: 1.5, depth: 4.5 },
  SLOT_SIZE: { width: 2.5, height: 1.8, depth: 5.0 },
  FLOOR_HEIGHT: 3.5,
  ELEVATOR_SPEED: 2.0,
  CAR_SPEED: 5.0,
  COLORS: {
    SLOT_EMPTY: 0x2a2a4a,
    SLOT_OCCUPIED: 0x4a6a4a,
    SLOT_HIGHLIGHT: 0xe94560,
    ELEVATOR: 0x533483,
    ELEVATOR_MOVING: 0xff6b6b,
    FLOOR: 0x16213e,
    STRUCTURE: 0x0f3460,
    CAR: [0x3498db, 0x2ecc71, 0xe74c3c, 0xf39c12, 0x9b59b6, 0x1abc9c],
    WARNING: 0xffb86c,
    ERROR: 0xff5555,
    CRITICAL: 0xff0040,
    TRAJECTORY: 0x00ff88
  },
  DEFAULT_VIEW: {
    top: { position: [0, 50, 0], target: [0, 0, 0] },
    front: { position: [0, 15, 40], target: [0, 10, 0] },
    side: { position: [40, 15, 0], target: [0, 10, 0] },
    free: { position: [25, 20, 25], target: [0, 5, 0] }
  }
};

export const RISK_TYPES = {
  SLOT_CONFLICT: {
    id: 'slot_conflict',
    name: '车位重复占用',
    severity: 'critical',
    description: '同一时间多个车辆占用同一车位'
  },
  ELEVATOR_CONFLICT: {
    id: 'elevator_conflict',
    name: '升降机跨层抢占',
    severity: 'error',
    description: '同一升降机被多个任务同时占用'
  },
  PATH_BLOCKED: {
    id: 'path_blocked',
    name: '通道阻塞',
    severity: 'error',
    description: '车辆行驶路径被其他车辆或障碍物阻挡'
  },
  PICKUP_TIMEOUT: {
    id: 'pickup_timeout',
    name: '取车超时',
    severity: 'warning',
    description: '取车任务超过预期时间阈值'
  },
  PARK_TIMEOUT: {
    id: 'park_timeout',
    name: '入库超时',
    severity: 'warning',
    description: '入库任务超过预期时间阈值'
  },
  DEVICE_OVERCAPACITY: {
    id: 'device_overcapacity',
    name: '设备超载',
    severity: 'critical',
    description: '车辆重量超过设备承载能力'
  }
};
