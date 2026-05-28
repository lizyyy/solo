export interface HoistPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  angle: number | null;
  assignedEquipment: string[];
}

export interface Equipment {
  id: string;
  name: string;
  type: 'light' | 'speaker' | 'safetyRope' | 'other';
  weight: number;
  quantity: number;
  assignedPointId: string | null;
}

export interface CableSpec {
  diameter: number;
  breakingLoad: number;
  material: string;
}

export interface CalculationParams {
  safetyFactor: number;
  gravity: number;
}

export type CheckType = 'angle' | 'weight' | 'factor' | 'cable';
export type CheckStatus = 'pass' | 'warning' | 'error';

export interface CheckResultItem {
  type: CheckType;
  status: CheckStatus;
  message: string;
  location?: string;
  suggestion: string;
}

export interface HoistPointResult {
  pointId: string;
  pointName: string;
  x: number;
  y: number;
  z: number;
  angle: number | null;
  totalWeight: number;
  verticalForce: number;
  horizontalForce: number;
  cableForce: number;
  safetyRatio: number;
  isSafe: boolean;
}

export interface VerificationReport {
  summary: {
    totalPoints: number;
    totalEquipment: number;
    totalWeight: number;
    maxCableForce: number;
    minSafetyRatio: number;
    overallStatus: 'safe' | 'warning' | 'danger';
  };
  checkResults: CheckResultItem[];
  pointResults: HoistPointResult[];
  equipmentList: Equipment[];
  cableSpec: CableSpec;
  params: CalculationParams;
  generatedAt: string;
  version: string;
}

export interface ImportData {
  version: string;
  hoistPoints: HoistPoint[];
  equipment: Equipment[];
  cableSpec: CableSpec;
  params: CalculationParams;
}

export const EQUIPMENT_TYPE_LABELS: Record<Equipment['type'], string> = {
  light: '灯具',
  speaker: '音箱',
  safetyRope: '安全绳',
  other: '其他'
};

export const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  angle: '角度检测',
  weight: '重量检测',
  factor: '系数检测',
  cable: '钢丝绳检测'
};

export const STATUS_LABELS: Record<CheckStatus, string> = {
  pass: '通过',
  warning: '警告',
  error: '错误'
};
