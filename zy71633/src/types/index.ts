export interface ExperimentParams {
  coilCurrent: number;
  coilTurns: number;
  projectileMass: number;
  projectileRadius: number;
  trackLength: number;
  stageCount: number;
}

export interface ExperimentResult {
  finalVelocity: number;
  maxAcceleration: number;
  kineticEnergy: number;
  maxTemperature: number;
  efficiency: number;
  duration: number;
  velocityData: { time: number; velocity: number }[];
  temperatureData: { time: number; coil: number; track: number }[];
}

export type AnomalyType = 'current_unit' | 'collision' | 'temp_missing' | 'duplicate_name' | 'date_format' | 'attachment_delay';
export type AnomalySeverity = 'info' | 'warning' | 'error';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  suggestion: string;
  objectId?: string;
  resolved: boolean;
  timestamp: Date;
}

export type SceneObjectType = 'coil' | 'projectile' | 'track' | 'sensor';

export interface SceneObject {
  id: string;
  name: string;
  type: SceneObjectType;
  position: [number, number, number];
  properties: Record<string, any>;
  hasAnomaly: boolean;
  temperature?: number;
}

export type ExperimentStatus = 'draft' | 'running' | 'completed' | 'error';

export interface Experiment {
  id: string;
  name: string;
  timestamp: Date;
  params: ExperimentParams;
  result: ExperimentResult | null;
  anomalies: Anomaly[];
  objects: SceneObject[];
  status: ExperimentStatus;
}

export type SimulationState = 'idle' | 'running' | 'paused' | 'completed';

export interface SimulationStore {
  state: SimulationState;
  currentTime: number;
  projectilePosition: number;
  projectileVelocity: number;
  temperatures: { coil: number; track: number };
  params: ExperimentParams;
  result: ExperimentResult | null;
  anomalies: Anomaly[];
  objects: SceneObject[];
  focusedObjectId: string | null;
  actions: {
    setParams: (params: Partial<ExperimentParams>) => void;
    startSimulation: () => void;
    pauseSimulation: () => void;
    resetSimulation: () => void;
    updateSimulation: (deltaTime: number) => void;
    focusObject: (objectId: string | null) => void;
    resolveAnomaly: (anomalyId: string) => void;
    addAnomaly: (anomaly: Omit<Anomaly, 'id' | 'timestamp'>) => void;
    checkForAnomalies: () => void;
  };
}

export interface HistoryStore {
  experiments: Experiment[];
  actions: {
    saveExperiment: (experiment: Experiment) => void;
    deleteExperiment: (id: string) => void;
    getExperiment: (id: string) => Experiment | undefined;
    clearAll: () => void;
  };
}

export const DEFAULT_PARAMS: ExperimentParams = {
  coilCurrent: 5000,
  coilTurns: 100,
  projectileMass: 0.1,
  projectileRadius: 0.025,
  trackLength: 2,
  stageCount: 3,
};

export const ANOMALY_RULES: Record<AnomalyType, { check: (params: ExperimentParams, result?: ExperimentResult) => boolean; severity: AnomalySeverity; description: string; suggestion: string }> = {
  current_unit: {
    check: (params) => params.coilCurrent < 10 || params.coilCurrent > 100000,
    severity: 'error',
    description: '电流单位可能错误',
    suggestion: '建议检查电流单位，正常范围应为10-100000安培。请退回重新输入或人工确认。',
  },
  collision: {
    check: (params) => params.projectileRadius > 0.05,
    severity: 'warning',
    description: '弹丸尺寸过大，可能发生穿模',
    suggestion: '建议调整弹丸半径在0.01-0.05米之间。可人工确认后继续。',
  },
  temp_missing: {
    check: (_, result) => !result || result.maxTemperature === 0,
    severity: 'warning',
    description: '温度数据缺失',
    suggestion: '温升漏算，建议补充温度传感器数据或等待附件上传。',
  },
  duplicate_name: {
    check: () => false,
    severity: 'info',
    description: '存在同名对象',
    suggestion: '建议重命名或覆盖原有对象。',
  },
  date_format: {
    check: () => false,
    severity: 'info',
    description: '日期格式不统一',
    suggestion: '系统已自动标准化格式。',
  },
  attachment_delay: {
    check: () => false,
    severity: 'warning',
    description: '附件比主表晚到超过12小时',
    suggestion: '数据可能不完整，可选择等待附件或继续实验。',
  },
};
