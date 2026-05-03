import dayjs from 'dayjs';

export interface SensorReading {
  pondId: string;
  timestamp: dayjs.Dayjs;
  dissolvedOxygen: number;
  temperature: number;
  pH?: number;
}

export interface FeedingEvent {
  pondId: string;
  timestamp: dayjs.Dayjs;
  feedType: string;
  feedAmount: number;
  feedingDuration: number;
}

export interface AeratorLog {
  pondId: string;
  aeratorId: string;
  timestamp: dayjs.Dayjs;
  action: 'start' | 'stop';
  power: number;
}

export interface MortalityRecord {
  pondId: string;
  timestamp: dayjs.Dayjs;
  count: number;
  cause?: string;
  notes?: string;
}

export interface ParsedData {
  sensorReadings: SensorReading[];
  feedingEvents: FeedingEvent[];
  aeratorLogs: AeratorLog[];
  mortalityRecords: MortalityRecord[];
}

export const RiskType = {
  LOW_DO_SUSTAINED: 'LOW_DO_SUSTAINED',
  DO_DROP_AFTER_FEEDING: 'DO_DROP_AFTER_FEEDING',
  AERATOR_RESPONSE_DELAY: 'AERATOR_RESPONSE_DELAY',
  SENSOR_DRIFT: 'SENSOR_DRIFT',
  UNEXPLAINED_MORTALITY: 'UNEXPLAINED_MORTALITY',
} as const;

export type RiskType = typeof RiskType[keyof typeof RiskType];

export interface RiskEvent {
  id: string;
  type: RiskType;
  pondId: string;
  timestamp: dayjs.Dayjs;
  endTimestamp?: dayjs.Dayjs;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: Record<string, any>;
}

export interface TimelineEvent {
  id: string;
  type: 'sensor' | 'feeding' | 'aerator' | 'mortality' | 'risk';
  timestamp: dayjs.Dayjs;
  pondId: string;
  data: any;
  riskType?: RiskType;
  severity?: string;
}

export interface FilterState {
  pondIds: string[];
  startDate: dayjs.Dayjs | null;
  endDate: dayjs.Dayjs | null;
}
