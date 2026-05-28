/**
 * 机器人仓储路径云图工作台 - 核心类型定义
 * 所有类型参考技术架构文档第4.2节
 */

// ==========================================
// 1. 坐标与空间类型
// ==========================================

/** 三维空间坐标点 */
export interface Position3D {
  /** X轴坐标（米） */
  x: number;
  /** Y轴坐标（米） */
  y: number;
  /** Z轴坐标（米） */
  z: number;
}

/** 空间包围盒，用于描述物体在三维空间中的边界范围 */
export interface BoundingBox {
  /** X轴最小值 */
  minX: number;
  /** X轴最大值 */
  maxX: number;
  /** Y轴最小值 */
  minY: number;
  /** Y轴最大值 */
  maxY: number;
  /** Z轴最小值 */
  minZ: number;
  /** Z轴最大值 */
  maxZ: number;
}

// ==========================================
// 2. 仓库模型类型
// ==========================================

/** 仓库整体模型 */
export interface Warehouse {
  /** 仓库唯一标识 */
  id: string;
  /** 仓库名称 */
  name: string;
  /** 楼层总数 */
  floorCount: number;
  /** 仓库宽度（米） */
  width: number;
  /** 仓库深度（米） */
  depth: number;
  /** 仓库高度（米） */
  height: number;
  /** 楼层列表 */
  floors: Floor[];
}

/** 楼层模型 */
export interface Floor {
  /** 楼层唯一标识 */
  id: string;
  /** 所属仓库ID */
  warehouseId: string;
  /** 楼层编号（从1开始） */
  level: number;
  /** Z轴位置（米），相对于地面 */
  zPosition: number;
  /** 货架列表 */
  shelves: Shelf[];
  /** 充电站列表 */
  chargingStations: ChargingStation[];
  /** 区域列表 */
  zones: Zone[];
}

/** 区域模型，用于划分仓库内不同功能区域 */
export interface Zone {
  /** 区域唯一标识 */
  id: string;
  /** 区域名称 */
  name: string;
  /** 所属楼层ID */
  floorId: string;
  /** 区域空间边界 */
  bounds: BoundingBox;
  /** 区域类型：存储区/拣选区/充电区/通道 */
  type: 'storage' | 'picking' | 'charging' | 'aisle';
}

/** 货架模型 */
export interface Shelf {
  /** 货架唯一标识 */
  id: string;
  /** 所属楼层ID */
  floorId: string;
  /** 货架位置坐标 */
  position: Position3D;
  /** 货架尺寸：宽、深、高（米） */
  dimensions: { width: number; depth: number; height: number };
  /** 最大容量（SKU总数） */
  capacity: number;
  /** 当前库存数量 */
  currentStock: number;
  /** 存放的SKU编号列表 */
  skuList: string[];
  /** 所属区域标识 */
  zone: string;
  /** 拥堵等级（0-1，可选），用于热力图渲染 */
  congestionLevel?: number;
  /** 是否存在数据缺失（可选），用于数据质量标识 */
  isMissingData?: boolean;
}

// ==========================================
// 3. 机器人与轨迹类型
// ==========================================

/** 机器人模型 */
export interface Robot {
  /** 机器人唯一标识 */
  id: string;
  /** 机器人名称/编号 */
  name: string;
  /** 机器人型号 */
  model: string;
  /** 机器人状态：空闲/工作中/充电中/故障 */
  status: 'idle' | 'working' | 'charging' | 'error';
  /** 电量百分比（0-100） */
  batteryLevel: number;
  /** 当前位置（可选），用于实时渲染 */
  currentPosition?: Position3D;
  /** 当前所在楼层（可选） */
  currentFloor?: number;
}

/** 轨迹点模型，记录机器人在某个时间点的状态 */
export interface TrajectoryPoint {
  /** 轨迹点唯一标识 */
  id: string;
  /** 所属机器人ID */
  robotId: string;
  /** 时间戳（毫秒） */
  timestamp: number;
  /** 空间位置坐标 */
  position: Position3D;
  /** 所在楼层编号 */
  floor: number;
  /** 移动速度（米/秒） */
  speed: number;
  /** 点状态：移动中/等待中/拣选中/充电中 */
  status: 'moving' | 'waiting' | 'picking' | 'charging';
  /** 是否为断点，断点间不计入密度统计 */
  isBreakpoint: boolean;
  /** 楼层识别置信度（0-1），低置信度可能存在楼层混淆 */
  floorConfidence: number;
}

/** 路径段模型，连接两个轨迹点的线段 */
export interface PathSegment {
  /** 路径段唯一标识 */
  id: string;
  /** 所属机器人ID */
  robotId: string;
  /** 起始轨迹点 */
  startPoint: TrajectoryPoint;
  /** 结束轨迹点 */
  endPoint: TrajectoryPoint;
  /** 路径密度（经过次数），用于云图颜色映射 */
  density: number;
  /** 平均速度（米/秒） */
  avgSpeed: number;
  /** 是否为断路段（数据中断），断路段用虚线渲染 */
  isBroken: boolean;
}

// ==========================================
// 4. 订单与充电类型
// ==========================================

/** 订单波次模型，一批订单的集合 */
export interface OrderWave {
  /** 波次唯一标识 */
  id: string;
  /** 波次名称/编号 */
  name: string;
  /** 开始时间戳（毫秒） */
  startTime: number;
  /** 结束时间戳（毫秒） */
  endTime: number;
  /** 订单总数 */
  orderCount: number;
  /** 涉及的SKU编号列表 */
  skuList: string[];
  /** 优先级（数字越大优先级越高） */
  priority: number;
  /** 数据是否完整，不完整的波次会在报表中标注 */
  isDataComplete: boolean;
}

/** 充电站模型 */
export interface ChargingStation {
  /** 充电站唯一标识 */
  id: string;
  /** 所属楼层ID */
  floorId: string;
  /** 充电站位置坐标 */
  position: Position3D;
  /** 充电站状态：可用/占用/离线 */
  status: 'available' | 'occupied' | 'offline';
  /** 充电功率（千瓦） */
  power: number;
  /** 当前正在充电的机器人ID（可选） */
  currentRobotId?: string;
  /** 充电排队列表 */
  queue: ChargingQueueItem[];
}

/** 充电排队项模型 */
export interface ChargingQueueItem {
  /** 排队项唯一标识 */
  id: string;
  /** 所属充电站ID */
  stationId: string;
  /** 排队机器人ID */
  robotId: string;
  /** 开始排队时间戳（毫秒） */
  startTime: number;
  /** 预计等待时长（秒） */
  waitDuration: number;
  /** 是否为重复排队项，用于标记去重后的数据 */
  isDuplicate: boolean;
  /** 去重来源ID（可选），记录从哪条记录合并而来 */
  deduplicatedFrom?: string;
}

/** 拥堵报告模型 */
export interface CongestionReport {
  /** 报告唯一标识 */
  id: string;
  /** 关联货架ID */
  shelfId: string;
  /** 拥堵开始时间戳（毫秒） */
  startTime: number;
  /** 拥堵结束时间戳（毫秒） */
  endTime: number;
  /** 拥堵原因描述 */
  reason: string;
  /** 涉及机器人数量 */
  robotCount: number;
  /** 平均等待时间（秒） */
  avgWaitTime: number;
  /** 是否已被人工修改，用于留痕追踪 */
  isManuallyModified: boolean;
}

// ==========================================
// 5. 修改留痕类型
// ==========================================

/** 数据修改记录模型，用于审计追踪 */
export interface DataModification {
  /** 修改记录唯一标识 */
  id: string;
  /** 实体类型：货架/轨迹/拥堵/充电 */
  entityType: 'shelf' | 'trajectory' | 'congestion' | 'charging';
  /** 被修改的实体ID */
  entityId: string;
  /** 被修改的字段名 */
  fieldName: string;
  /** 修改前的值（字符串序列化） */
  oldValue: string;
  /** 修改后的值（字符串序列化） */
  newValue: string;
  /** 修改人标识 */
  modifiedBy: string;
  /** 修改时间戳（毫秒） */
  modifiedAt: number;
  /** 修改理由（必填，至少10字符） */
  reason: string;
  /** 是否为回滚操作 */
  isRollback: boolean;
  /** 回滚来源ID（可选），记录从哪条修改回滚 */
  rollbackFrom?: string;
}

// ==========================================
// 6. 筛选与视图状态类型
// ==========================================

/** 筛选条件状态 */
export interface FilterState {
  /** 时间范围：开始和结束时间戳（毫秒） */
  timeRange: { start: number; end: number };
  /** 选中的订单波次ID */
  selectedWaveId: string | null;
  /** 选中的机器人ID列表 */
  selectedRobotIds: string[];
  /** 选中的楼层编号 */
  selectedFloor: number | null;
  /** 选中的区域标识 */
  selectedZone: string | null;
  /** 是否显示路径云图 */
  showPaths: boolean;
  /** 是否显示热力图 */
  showHeatmap: boolean;
  /** 是否显示充电排队 */
  showQueue: boolean;
  /** 密度阈值（0-1），低于阈值的路径不显示 */
  densityThreshold: number;
}

/** 视图状态，用于3D场景控制 */
export interface ViewState {
  /** 相机位置坐标 */
  cameraPosition: Position3D;
  /** 相机注视目标点 */
  cameraTarget: Position3D;
  /** 当前选中的元素ID */
  selectedElementId: string | null;
  /** 当前选中的元素类型 */
  selectedElementType: 'shelf' | 'robot' | 'station' | 'path' | null;
  /** 是否正在播放时间轴动画 */
  isPlayingTimeline: boolean;
  /** 时间轴播放速度倍率（0.5x, 1x, 2x 等） */
  timelinePlaybackSpeed: number;
}

// ==========================================
// 7. 数据质量类型
// ==========================================

/** 数据质量问题模型 */
export interface DataQualityIssue {
  /** 问题唯一标识 */
  id: string;
  /** 问题类型：字段缺失/轨迹断点/楼层混淆/重复排队 */
  type: 'missing_field' | 'trajectory_break' | 'floor_confusion' | 'duplicate_queue';
  /** 严重程度：错误/警告/提示 */
  severity: 'error' | 'warning' | 'info';
  /** 关联实体类型 */
  entityType: string;
  /** 关联实体ID */
  entityId: string;
  /** 关联字段名（可选） */
  fieldName?: string;
  /** 问题描述 */
  description: string;
  /** 是否可自动修复 */
  canFix: boolean;
}

/** 数据源状态模型 */
export interface DataSourceStatus {
  /** 数据源类型：仓库/轨迹/货架/订单/充电/拥堵 */
  type: 'warehouse' | 'trajectory' | 'shelf' | 'order' | 'charging' | 'congestion';
  /** 数据源名称 */
  name: string;
  /** 是否已连接 */
  isConnected: boolean;
  /** 最后同步时间戳（毫秒） */
  lastSyncTime: number;
  /** 记录总数 */
  recordCount: number;
  /** 数据质量评分（0-100） */
  qualityScore: number;
  /** 存在的数据质量问题列表 */
  issues: DataQualityIssue[];
}
