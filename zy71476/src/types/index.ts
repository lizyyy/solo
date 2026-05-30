export interface ExperimentParams {
  angle: number;
  mass: number;
  frictionCoefficient: number;
}

export interface ForceAnalysis {
  gravity: number;
  normalForce: number;
  frictionForce: number;
  parallelForce: number;
  perpendicularForce: number;
  maxStaticFriction: number;
}

export type BlockStatus = 'static' | 'sliding' | 'critical';

export interface ThresholdResult {
  status: BlockStatus;
  criticalAngle: number;
  reason: string;
}

export type ErrorType = 'angle_unit' | 'friction_out_of_range' | 'mass_zero' | 'conflict' | 'angle_out_of_range';

export interface ErrorRecord {
  id: string;
  timestamp: number;
  type: ErrorType;
  message: string;
  params: ExperimentParams;
  resolved: boolean;
}

export interface ConflictRecord {
  id: string;
  timestamp: number;
  angleEvidence: { param: string; value: number; priority: number; evidence: string };
  massEvidence: { param: string; value: number; priority: number; evidence: string };
  frictionEvidence: { param: string; value: number; priority: number; evidence: string };
  resolution: string;
  finalJudgment: BlockStatus;
}

export type SelectedObject = 'plane' | 'block' | null;

export interface ExperimentState {
  params: ExperimentParams;
  forces: ForceAnalysis;
  threshold: ThresholdResult;
  selectedObject: SelectedObject;
  errorTraces: ErrorRecord[];
  conflictTraces: ConflictRecord[];
  isPlaying: boolean;
  blockPosition: number;
}

export interface ObjectInfo {
  type: SelectedObject;
  name: string;
  description: string;
  properties: Record<string, string | number>;
}

export const DEFAULT_PARAMS: ExperimentParams = {
  angle: 30,
  mass: 1,
  frictionCoefficient: 0.5,
};

export const PHYSICAL_CONSTANTS = {
  GRAVITY: 9.8,
  MIN_ANGLE: 0,
  MAX_ANGLE: 90,
  MIN_MASS: 0.1,
  MAX_MASS: 10,
  MIN_FRICTION: 0,
  MAX_FRICTION: 1,
  CRITICAL_THRESHOLD: 0.01,
} as const;

export const STATUS_TEXT: Record<BlockStatus, string> = {
  static: '静止',
  sliding: '滑动',
  critical: '临界',
};

export const STATUS_COLOR: Record<BlockStatus, string> = {
  static: '#10B981',
  sliding: '#EF4444',
  critical: '#F59E0B',
};

export const FORCE_INFO = {
  gravity: { name: '重力', symbol: 'G', color: '#EF4444', unit: 'N' },
  normalForce: { name: '支持力', symbol: 'N', color: '#3B82F6', unit: 'N' },
  frictionForce: { name: '摩擦力', symbol: 'f', color: '#8B5CF6', unit: 'N' },
  parallelForce: { name: '沿斜面分力', symbol: 'G₁', color: '#10B981', unit: 'N' },
  perpendicularForce: { name: '垂直分力', symbol: 'G₂', color: '#06B6D4', unit: 'N' },
  maxStaticFriction: { name: '最大静摩擦', symbol: 'f_max', color: '#F59E0B', unit: 'N' },
} as const;

export const ERROR_MESSAGES: Record<ErrorType, string> = {
  angle_unit: '角度单位错误，请使用度数(°)',
  angle_out_of_range: '角度超出有效范围(0°-90°)',
  friction_out_of_range: '摩擦系数超出有效范围(0-1)',
  mass_zero: '质量不能为零或负数',
  conflict: '参数判定冲突，已按优先级处理',
};
