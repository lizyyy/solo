export type RecordStatus = 'pending' | 'confirmed' | 'returned' | 'supplement';

export type ParameterType = 'dissolved_oxygen' | 'turbidity' | 'ph' | 'salinity' | 'temperature';

export interface CleaningStep {
  id: string;
  stepOrder: number;
  stepName: string;
  inputValue: number;
  outputValue: number;
  description: string;
  hasIssue: boolean;
  issueDetail?: string;
}

export interface WaterQualityRecord {
  id: string;
  recordNo: string;
  shipName: string;
  measureDate: string;
  measureTime: string;
  location: string;
  parameterType: ParameterType;
  rawValue: number;
  cleanedValue: number;
  unit: string;
  hasDrift: boolean;
  driftAmount: number;
  originalNote: string;
  supplementaryNote: string;
  hasSupplementaryNote: boolean;
  status: RecordStatus;
  cleaningSteps: CleaningStep[];
  missingEvidence: string[];
  createdAt: string;
}

export interface ParameterScheme {
  id: string;
  name: string;
  description: string;
  parameters: {
    outlierThreshold: number;
    driftCorrectionEnabled: boolean;
    smoothingWindowSize: number;
    interpolationMethod: string;
    minValidValue: number;
    maxValidValue: number;
  };
  isActive: boolean;
}

export type EventType = 'create' | 'clean' | 'review' | 'drift' | 'status_change' | 'note';

export interface TimelineEvent {
  id: string;
  recordId: string;
  eventTime: string;
  eventType: EventType;
  operator: string;
  description: string;
  detail?: Record<string, unknown>;
}

export const parameterTypeLabels: Record<ParameterType, string> = {
  dissolved_oxygen: '溶解氧',
  turbidity: '浊度',
  ph: 'pH值',
  salinity: '盐度',
  temperature: '水温',
};

export const parameterTypeUnits: Record<ParameterType, string> = {
  dissolved_oxygen: 'mg/L',
  turbidity: 'NTU',
  ph: '',
  salinity: '‰',
  temperature: '°C',
};

export const statusLabels: Record<RecordStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  returned: '退回',
  supplement: '待补件',
};

export const eventTypeLabels: Record<EventType, string> = {
  create: '记录创建',
  clean: '数据清洗',
  review: '复核操作',
  drift: '漂移处理',
  status_change: '状态变更',
  note: '备注添加',
};
