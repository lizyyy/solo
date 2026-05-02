// 展厅元素类型
export type ElementType = 'exhibit' | 'entrance' | 'exit' | 'restricted' | 'obstacle';

// 基础位置
export interface Position {
  x: number;
  z: number;
  y?: number;
}

// 展厅元素
export interface ExhibitionElement {
  id: string;
  type: ElementType;
  name: string;
  position: Position;
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  rotation?: number;
  description?: string;
}

// 展厅配置 (JSON 格式)
export interface ExhibitionConfig {
  version: string;
  exhibitionName: string;
  exhibitionDate: string;
  venue: string;
  floor: {
    width: number;
    depth: number;
    height: number;
  };
  elements: ExhibitionElement[];
}

// 时段数据 (CSV 格式)
export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  visitorCount: number;
  description?: string;
}

// 访客实体
export interface Visitor {
  id: string;
  position: Position;
  targetPosition: Position | null;
  visitedExhibits: string[];
  status: 'entering' | 'viewing' | 'moving' | 'exiting';
  speed: number;
  angle: number;
  targetExhibitId: string | null;
}

// 热区数据
export interface HeatZone {
  x: number;
  z: number;
  visitorCount: number;
  riskLevel: RiskLevel;
  riskType: RiskType[];
  density: number;
}

// 风险等级
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// 风险类型
export type RiskType = 'congestion' | 'stagnation' | 'retrograde' | 'bottleneck';

// 模拟结果
export interface SimulationResult {
  timeSlotId: string;
  timeSlot: TimeSlot;
  visitors: Visitor[];
  heatZones: HeatZone[];
  riskSummary: RiskSummary;
  timestamp: number;
}

// 风险摘要
export interface RiskSummary {
  totalVisitors: number;
  criticalZones: number;
  highZones: number;
  mediumZones: number;
  lowZones: number;
  congestionCount: number;
  stagnationCount: number;
  retrogradeCount: number;
  bottleneckCount: number;
  averageDensity: number;
  maxDensity: number;
}

// 应用状态
export interface AppState {
  currentConfig: ExhibitionConfig | null;
  currentTimeSlots: TimeSlot[];
  selectedTimeSlot: TimeSlot | null;
  simulationResult: SimulationResult | null;
  sceneLoaded: boolean;
  isSimulating: boolean;
  selectedElement: ExhibitionElement | null;
  simulationSpeed: number;
  gridSize: number;
}

// 导出的方案
export interface SavedPlan {
  config: ExhibitionConfig;
  timeSlots: TimeSlot[];
  savedAt: string;
  simulationResults: SimulationResult[];
}

// 截图配置
export interface ScreenshotOptions {
  width: number;
  height: number;
  includeLabels: boolean;
  includeHeatmap: boolean;
}

// 报告配置
export interface ReportOptions {
  includeScreenshot: boolean;
  includeRiskAnalysis: boolean;
  includeRecommendations: boolean;
}
