// 瓷砖类型定义
export interface Tile {
  id: string;
  name: string;
  width: number; // 厘米
  height: number; // 厘米
  pricePerBox: number; // 每盒价格
  tilesPerBox: number; // 每盒数量
  batch?: string; // 批次号（可选）
  colorTolerance?: number; // 色差容差（0-1，0表示完全匹配）
}

// 房间尺寸
export interface RoomDimensions {
  width: number; // 厘米
  length: number; // 厘米
  height?: number; // 高度（可选，用于墙砖计算）
}

// 门洞/窗洞等障碍物
export interface Opening {
  id: string;
  type: 'door' | 'window' | 'other';
  width: number; // 厘米
  height: number; // 厘米
  offsetX: number; // 从左边缘的偏移
  offsetY: number; // 从下边缘的偏移
}

// 铺贴方向
export type LayoutDirection = 'horizontal' | 'vertical' | 'diagonal';

// 铺贴图案
export type LayoutPattern = 'straight' | 'brick' | 'herringbone' | 'diagonal';

// 损耗模型
export interface LossModel {
  standard: number; // 标准损耗百分比（如5%）
  diagonal: number; // 斜铺额外损耗百分比
  complexShapes: number; // 复杂形状额外损耗百分比
  batchDifference: number; // 批次差异预留百分比
  wasteUsage: boolean; // 是否允许使用切割边角料
}

// 输入数据
export interface InputData {
  room: RoomDimensions;
  openings: Opening[];
  tile: Tile;
  layoutDirection: LayoutDirection;
  layoutPattern: LayoutPattern;
  groutWidth: number; // 缝宽（厘米）
  lossModel: LossModel;
  batchOptions: {
    allowMultipleBatches: boolean;
    preferredBatches: string[];
    colorTolerance: number;
  };
}

// 验证错误
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  value?: string | number;
}

// 脏数据记录
export interface DirtyDataRecord {
  id: string;
  field: string;
  originalValue: string | number;
  correctedValue?: string | number;
  reason: string;
  source: string;
  timestamp: number;
}

// 计算结果
export interface CalculationResult {
  totalArea: number; // 总面积（平方米）
  netArea: number; // 净面积（扣除门洞后）
  tilesNeeded: number; // 需要的瓷砖数量
  boxesNeeded: number; // 需要的盒数
  wasteTiles: number; // 损耗瓷砖数量
  wastePercentage: number; // 损耗百分比
  totalCost: number; // 总费用
  breakdown: CalculationBreakdown[];
  batchRecommendations: BatchRecommendation[];
  feasibility: FeasibilityResult;
  assumptions: KeyAssumption[];
}

// 计算分解
export interface CalculationBreakdown {
  step: string;
  input: string;
  output: string;
  formula?: string;
}

// 批次推荐
export interface BatchRecommendation {
  batchNumber: string;
  tilesNeeded: number;
  boxesNeeded: number;
  colorMatchScore: number; // 0-1，1表示完全匹配
  reasons: string[];
}

// 可行性结果
export interface FeasibilityResult {
  isFeasible: boolean;
  score: number; // 0-100
  issues: FeasibilityIssue[];
}

// 可行性问题
export interface FeasibilityIssue {
  type: 'critical' | 'warning' | 'info';
  category: 'layout' | 'batch' | 'waste' | 'dimension';
  message: string;
  suggestion?: string;
  affectedFields: string[];
}

// 关键假设
export interface KeyAssumption {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  source: string;
  canBeModified: boolean;
}

// 计算步骤
export interface CalculationStep {
  id: string;
  title: string;
  description: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  failureReason?: string;
  success: boolean;
  timestamp: number;
}

// 应用状态
export interface AppState {
  inputData: InputData;
  calculationSteps: CalculationStep[];
  dirtyDataRecords: DirtyDataRecord[];
  validationErrors: ValidationError[];
  result?: CalculationResult;
  currentStep: number;
}

// 铺贴方案
export interface LayoutOption {
  id: string;
  name: string;
  direction: LayoutDirection;
  pattern: LayoutPattern;
  estimatedWaste: number;
  advantages: string[];
  disadvantages: string[];
  isRecommended: boolean;
}
